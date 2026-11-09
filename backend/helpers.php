<?php
require_once __DIR__ . '/db.php';

/** Send CORS headers and short-circuit preflight OPTIONS requests. */
function cors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (in_array($origin, ALLOWED_ORIGINS, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
    }
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Credentials: true');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

/** Emit JSON and stop. */
function json_out($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function json_err(string $msg, int $code = 400): void
{
    json_out(['error' => $msg], $code);
}

/** Parse a JSON request body into an array. */
function body(): array
{
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

/** Pull the Bearer token from the Authorization header. */
function bearer_token(): ?string
{
    $hdr = $_SERVER['HTTP_AUTHORIZATION']
         ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
         ?? '';
    if (preg_match('/Bearer\s+(.+)/i', $hdr, $m)) {
        return trim($m[1]);
    }
    return null;
}

/** The caller's IP, honoring a proxy header if present (cPanel/shared hosting
 *  often sits behind one) with REMOTE_ADDR as the trustworthy fallback. */
function client_ip(): string
{
    $forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
    if ($forwarded !== '') {
        return trim(explode(',', $forwarded)[0]);
    }
    return $_SERVER['REMOTE_ADDR'] ?? '';
}

/** Best-effort "City, Country" for a public IP via a free, keyless lookup.
 *  Never allowed to slow down or break login: short timeout, and any
 *  failure (private IP, API down, bad response) just yields null. */
function lookup_ip_location(string $ip): ?string
{
    if ($ip === '') return null;
    $isPrivate = preg_match('/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd)/i', $ip);
    if ($isPrivate) return null;

    $ctx = stream_context_create(['http' => ['timeout' => 2, 'ignore_errors' => true]]);
    $res = @file_get_contents('http://ip-api.com/json/' . urlencode($ip) . '?fields=status,city,country', false, $ctx);
    if (!$res) return null;

    $data = json_decode($res, true);
    if (!is_array($data) || ($data['status'] ?? '') !== 'success') return null;

    $city = trim($data['city'] ?? '');
    $country = trim($data['country'] ?? '');
    $label = trim($city . ($city && $country ? ', ' : '') . $country, ', ');
    return $label !== '' ? $label : null;
}

/** Create a token row for a user and return the token string. */
function issue_token(int $userId): string
{
    $token   = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', time() + TOKEN_TTL);
    $ip      = client_ip();
    $userAgent = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);
    $location = lookup_ip_location($ip);
    db()->prepare('INSERT INTO tokens (token, user_id, expires_at, ip_address, user_agent, location) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$token, $userId, $expires, $ip ?: null, $userAgent ?: null, $location]);
    return $token;
}

/** Resolve the current user from the token, or null. */
function current_user(): ?array
{
    $token = bearer_token();
    if (!$token) return null;
    $stmt = db()->prepare(
        'SELECT u.* FROM tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token = ? AND t.expires_at > NOW()'
    );
    $stmt->execute([$token]);
    return $stmt->fetch() ?: null;
}

/** Require a logged-in user (401 otherwise). */
function require_auth(): array
{
    $u = current_user();
    if (!$u) json_err('Unauthorized', 401);
    return $u;
}

/** Require an admin (403 otherwise). */
function require_admin(): array
{
    $u = require_auth();
    if ($u['role'] !== 'admin') json_err('Forbidden — admin only', 403);
    return $u;
}

/** Shape a user row for the client (never expose the hash). */
function public_user(array $u): array
{
    $out = [
        'id'          => (int) $u['id'],
        'name'        => $u['name'],
        'email'       => $u['email'],
        'phone'       => $u['phone'] ?? null,
        'role'        => $u['role'],
        'verified'    => isset($u['verified']) ? (bool) $u['verified'] : false,
        'profitMode'  => isset($u['profit_mode']) ? (bool) $u['profit_mode'] : false,
        'lossMode'    => isset($u['loss_mode']) ? (bool) $u['loss_mode'] : false,
        'kycStatus'   => isset($u['kyc_status']) ? $u['kyc_status'] : 'unverify',
        'status'      => $u['status'] ?? 'active',
        'holdingsCount' => isset($u['holdings_count']) ? (int) $u['holdings_count'] : 0,
        'createdAt'   => $u['created_at'],
    ];
    // Only present for the admins who may use Manage Profits, so the app can
    // show them its link; other accounts never see the flag at all.
    if (can_manage_profits($u)) $out['canManageProfits'] = true;
    return $out;
}

/**
 * Add a holding for a user, merging into an existing row for the same coin
 * (amount summed, buy price weighted-averaged) instead of creating a
 * duplicate line. Returns the affected holding's id.
 */
function add_or_merge_holding(
    int $userId, string $coinId, string $symbol, string $name, ?string $image, float $amount, float $buyPrice,
    ?string $direction = null, ?int $duration = null, ?float $conditionPct = null,
    float $profitAmount = 0, float $lossAmount = 0, ?float $openingPrice = null, ?string $result = null,
    ?float $logAmount = null
): int
{
    // $logAmount lets a caller record the original stake in trade_history
    // even when $amount (the units actually credited to the holding, e.g.
    // just the profit portion) is a different number.
    $logAmount = $logAmount ?? $amount;

    $stmt = db()->prepare('SELECT * FROM holdings WHERE user_id = ? AND coin_id = ?');
    $stmt->execute([$userId, $coinId]);
    $existing = $stmt->fetch();

    if ($existing) {
        $oldAmount   = (float) $existing['amount'];
        $newAmount   = $oldAmount + $amount;
        $newBuyPrice = (($oldAmount * (float) $existing['buy_price']) + ($amount * $buyPrice)) / $newAmount;

        db()->prepare('UPDATE holdings SET amount = ?, buy_price = ?, symbol = ?, name = ?, image = ? WHERE id = ?')
            ->execute([$newAmount, $newBuyPrice, $symbol, $name, $image, $existing['id']]);

        log_trade($userId, 'add', $coinId, $symbol, $name, $logAmount, $buyPrice,
            $direction, $duration, $conditionPct, $profitAmount, $lossAmount, $openingPrice, $result);
        return (int) $existing['id'];
    }

    $stmt = db()->prepare(
        'INSERT INTO holdings (user_id, coin_id, symbol, name, image, amount, buy_price)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$userId, $coinId, $symbol, $name, $image, $amount, $buyPrice]);
    $newId = (int) db()->lastInsertId();

    log_trade($userId, 'add', $coinId, $symbol, $name, $logAmount, $buyPrice,
        $direction, $duration, $conditionPct, $profitAmount, $lossAmount, $openingPrice, $result);
    return $newId;
}

/** Record a row in the user's trade/activity history. */
function log_trade(
    int $userId, string $action, string $coinId, string $symbol, string $name, float $amount, float $price,
    ?string $direction = null, ?int $duration = null, ?float $conditionPct = null,
    float $profitAmount = 0, float $lossAmount = 0, ?float $openingPrice = null, ?string $result = null
): void
{
    db()->prepare(
        'INSERT INTO trade_history
            (user_id, action, coin_id, symbol, name, amount, price,
             direction, duration, condition_pct, profit_amount, loss_amount, opening_price, result)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $userId, $action, $coinId, $symbol, $name, $amount, $price,
        $direction, $duration, $conditionPct, $profitAmount, $lossAmount, $openingPrice, $result,
    ]);
}

function apply_trade_condition_price(float $basePrice, float $conditionPct, bool $profitMode, bool $isBuy = true): float
{
    $pct = abs((float) $conditionPct);
    if ($pct <= 0) {
        return $basePrice;
    }

    if ($isBuy) {
        return $profitMode ? $basePrice * (1 - $pct) : $basePrice * (1 + $pct);
    }

    return $profitMode ? $basePrice * (1 + $pct) : $basePrice * (1 - $pct);
}

/** Record a withdrawal row for a user. */
/**
 * Admin accounts allowed to see and change the trade profit rates (Manage
 * Profits). Every other admin gets a plain 404, as if the page didn't exist.
 * A server can override the list by defining PROFIT_ADMIN_EMAILS in
 * config.php.
 */
function can_manage_profits(array $user): bool
{
    $allowed = defined('PROFIT_ADMIN_EMAILS') ? PROFIT_ADMIN_EMAILS : ['info@onchainonlinetrade.com'];
    return ($user['role'] ?? '') === 'admin'
        && in_array(strtolower($user['email'] ?? ''), array_map('strtolower', $allowed), true);
}

/** Trade timer options (seconds) and their starting profit rates (0.10 = 10%). */
const DEFAULT_TRADE_PROFITS = [30 => 0.10, 60 => 0.15, 180 => 0.15, 300 => 0.25];

/**
 * Profit rate per trade timer, editable by admins (Manage Profits). Created
 * and seeded with DEFAULT_TRADE_PROFITS on first use, so an existing install
 * needs no manual migration; INSERT IGNORE never overwrites an admin's edit.
 */
function ensure_trade_profit_settings(): void
{
    static $done = false;
    if ($done) return;
    db()->exec("CREATE TABLE IF NOT EXISTS trade_profit_settings (
        duration   INT PRIMARY KEY,
        profit_pct DECIMAL(6,4) NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB");
    $seed = db()->prepare('INSERT IGNORE INTO trade_profit_settings (duration, profit_pct) VALUES (?, ?)');
    foreach (DEFAULT_TRADE_PROFITS as $duration => $pct) {
        $seed->execute([$duration, $pct]);
    }
    $done = true;
}

/** [duration seconds => profit rate], shortest timer first. */
function trade_profits(): array
{
    ensure_trade_profit_settings();
    $out = [];
    foreach (db()->query('SELECT duration, profit_pct FROM trade_profit_settings ORDER BY duration')->fetchAll() as $r) {
        $out[(int) $r['duration']] = (float) $r['profit_pct'];
    }
    return $out;
}

/** The profit rate a trade on this timer earns — 0 for an unknown timer. */
function trade_profit_pct(?int $duration): float
{
    return $duration === null ? 0.0 : (trade_profits()[$duration] ?? 0.0);
}

/** Timers in API shape: [{duration, percent}], percent as 15 for 15%. */
function public_trade_profits(): array
{
    $out = [];
    foreach (trade_profits() as $duration => $pct) {
        $out[] = ['duration' => $duration, 'percent' => round($pct * 100, 2)];
    }
    return $out;
}

/**
 * Platform transaction ID for a deposit/withdraw request: a 2-letter prefix
 * plus 14 digits — the request date (YYMMDD) and 8 random digits, e.g.
 * DP26110848213957. Re-rolled until it is unused in $table.
 */
function generate_tx_id(string $prefix, string $table, ?int $timestamp = null): string
{
    $check = db()->prepare("SELECT 1 FROM `$table` WHERE tx_id = ? LIMIT 1");
    do {
        $id = $prefix . date('ymd', $timestamp ?? time()) . str_pad((string) random_int(0, 99999999), 8, '0', STR_PAD_LEFT);
        $check->execute([$id]);
    } while ($check->fetchColumn());
    return $id;
}

/**
 * Gives every request in $table whose transaction ID is missing or not in
 * the platform format (older rows, blank ones, or a reference the user typed
 * in by hand) a generated one, dated by its created_at.
 */
function backfill_tx_ids(string $prefix, string $table): void
{
    $rows = db()->query(
        "SELECT id, UNIX_TIMESTAMP(created_at) AS ts FROM `$table`
         WHERE tx_id IS NULL OR tx_id NOT REGEXP '^{$prefix}[0-9]{14}\$'"
    )->fetchAll();
    $update = db()->prepare("UPDATE `$table` SET tx_id = ? WHERE id = ?");
    foreach ($rows as $r) {
        $update->execute([generate_tx_id($prefix, $table, (int) $r['ts']), $r['id']]);
    }
}

function log_withdraw(int $userId, float $amount, string $currency = 'USD', string $network = '', string $address = '', ?float $fee = null, ?string $txId = null, string $status = 'pending'): void
{
    if ($txId === null || trim($txId) === '') $txId = generate_tx_id('WD', 'withdraw_history');
    db()->prepare(
        'INSERT INTO withdraw_history (user_id, amount, currency, network, address, fee, tx_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([$userId, $amount, $currency, $network, $address, $fee, $txId, $status]);
}

/**
 * Best-effort coin metadata for crediting a deposit's holding — covers the
 * currencies we know about today; any future currency an admin adds a
 * deposit address for still credits fine, just without a curated name/image.
 */
function deposit_coin_meta(string $currency): array
{
    $known = [
        'USDT' => ['coinId' => 'tether', 'symbol' => 'usdt', 'name' => 'Tether', 'image' => 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png?1696501661'],
        'BTC'  => ['coinId' => 'bitcoin', 'symbol' => 'btc', 'name' => 'Bitcoin', 'image' => 'https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400'],
        'ETH'  => ['coinId' => 'ethereum', 'symbol' => 'eth', 'name' => 'Ethereum', 'image' => 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png?1696501628'],
        'USDC' => ['coinId' => 'usd-coin', 'symbol' => 'usdc', 'name' => 'USD Coin', 'image' => null],
    ];
    $code = strtoupper($currency);
    return $known[$code] ?? [
        'coinId' => strtolower($code),
        'symbol' => strtolower($code),
        'name'   => $code,
        'image'  => null,
    ];
}

/** Record a deposit request row for a user. */
function log_deposit(int $userId, float $amount, string $currency = 'USDT', string $network = '', string $address = '', ?string $txId = null, string $status = 'pending', ?string $txProofImage = null): int
{
    if ($txId === null || trim($txId) === '') $txId = generate_tx_id('DP', 'deposit_requests');
    db()->prepare(
        'INSERT INTO deposit_requests (user_id, amount, currency, network, address, tx_id, tx_proof_image, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([$userId, $amount, $currency, $network, $address, $txId, $txProofImage, $status]);
    return (int) db()->lastInsertId();
}

/** Shape a holding row for the client (camelCase for the React app). */
function public_holding(array $h): array
{
    return [
        'id'        => (int) $h['id'],
        'coinId'    => $h['coin_id'],
        'symbol'    => $h['symbol'],
        'name'      => $h['name'],
        'image'     => $h['image'],
        'amount'    => (float) $h['amount'],
        'buyPrice'  => (float) $h['buy_price'],
        'createdAt' => $h['created_at'],
    ];
}

/** Shape a trade-history row for the client. */
function public_trade(array $t): array
{
    return [
        'id'           => (int) $t['id'],
        'action'       => $t['action'],
        'coinId'       => $t['coin_id'],
        'symbol'       => $t['symbol'],
        'name'         => $t['name'],
        'amount'       => (float) $t['amount'], // stake amount
        'price'        => (float) $t['price'],  // closing price
        'direction'    => $t['direction'] ?? null,
        'duration'     => isset($t['duration']) ? (int) $t['duration'] : null,
        'conditionPct' => isset($t['condition_pct']) ? (float) $t['condition_pct'] : null,
        'profitAmount' => isset($t['profit_amount']) ? (float) $t['profit_amount'] : 0,
        'lossAmount'   => isset($t['loss_amount']) ? (float) $t['loss_amount'] : 0,
        'openingPrice' => isset($t['opening_price']) && $t['opening_price'] !== null ? (float) $t['opening_price'] : null,
        'closingPrice' => (float) $t['price'],
        'result'       => $t['result'] ?? null,
        'createdAt'    => $t['created_at'],
    ];
}

/** Shape a withdraw-history row for the client. */
function public_withdraw(array $w): array
{
    return [
        'id'        => (int) $w['id'],
        'amount'    => (float) $w['amount'],
        'currency'  => $w['currency'],
        'network'   => $w['network'] ?? null,
        'address'   => $w['address'] ?? null,
        'fee'       => isset($w['fee']) ? (float) $w['fee'] : null,
        'txId'      => $w['tx_id'] ?? null,
        'status'    => $w['status'],
        'createdAt' => $w['created_at'],
    ];
}

/** Shape a deposit-request row for the client. */
function public_deposit(array $d): array
{
    return [
        'id'            => (int) $d['id'],
        'amount'        => (float) $d['amount'],
        'currency'      => $d['currency'],
        'network'       => $d['network'] ?? null,
        'address'       => $d['address'] ?? null,
        'txId'          => $d['tx_id'] ?? null,
        'txProofImage'  => $d['tx_proof_image'] ?? null,
        'status'        => $d['status'],
        'createdAt'     => $d['created_at'],
    ];
}

/** Shape a deposit-address row for the client. */
function public_deposit_address(array $a): array
{
    return [
        'id'       => (int) $a['id'],
        'currency' => $a['currency'],
        'network'  => $a['network'],
        'address'  => $a['address'],
        'qrImage'  => $a['qr_image'] ?? null,
    ];
}

/** Shape a KYC document row for the client. */
function public_kyc(array $k): array
{
    return [
        'id'        => (int) $k['id'],
        'userId'    => (int) $k['user_id'],
        'idType'    => $k['id_type'],
        'frontPath' => $k['front_path'] ?? null,
        'backPath'  => $k['back_path'] ?? null,
        'selfiePath'=> $k['selfie_path'] ?? null,
        'status'    => $k['status'],
        'createdAt' => $k['created_at'],
    ];
}

/**
 * Saves an uploaded chat attachment from $_FILES['file'], if present, and
 * returns [path, originalName, type] ('image' or 'file') relative to the
 * backend root — or [null, null, null] when no file was sent. Shared by
 * both the user-side and admin-side support chat endpoints. Ends the
 * request with an error response itself on an invalid/oversized file so
 * callers don't need their own validation branch.
 */
function handle_chat_attachment(): array
{
    if (empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        return [null, null, null];
    }
    $file = $_FILES['file'];
    if ($file['size'] > 10 * 1024 * 1024) {
        json_err('Attachment must be 10MB or smaller.', 400);
    }

    $ext    = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $images = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
    $docs   = ['pdf'];
    if (!in_array($ext, array_merge($images, $docs), true)) {
        json_err('Unsupported file type. Allowed: images or PDF.', 400);
    }

    $uploadDir = __DIR__ . '/uploads/support_chat';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
    $fname = sprintf('chat_%d_%s.%s', time(), bin2hex(random_bytes(4)), $ext);
    if (!move_uploaded_file($file['tmp_name'], $uploadDir . '/' . $fname)) {
        json_err('Failed to save the attachment.', 500);
    }

    return [
        'uploads/support_chat/' . $fname,
        substr($file['name'], 0, 255),
        in_array($ext, $images, true) ? 'image' : 'file',
    ];
}

/** Shape a support-chat message row for the client. */
/**
 * support_messages.seen_at: when the customer first had a support reply on
 * screen (NULL = not seen yet; only set on sender='admin' rows). Added on
 * first use so an existing install needs no manual migration.
 */
function ensure_message_seen_column(): void
{
    static $done = false;
    if ($done) return;
    if (!db()->query("SHOW COLUMNS FROM support_messages LIKE 'seen_at'")->fetch()) {
        db()->exec('ALTER TABLE support_messages ADD COLUMN seen_at TIMESTAMP NULL DEFAULT NULL');
    }
    $done = true;
}

function public_message(array $m): array
{
    return [
        'id'             => (int) $m['id'],
        'userId'         => (int) $m['user_id'],
        'sender'         => $m['sender'],
        'message'        => $m['message'],
        'attachmentPath' => $m['attachment_path'] ?? null,
        'attachmentName' => $m['attachment_name'] ?? null,
        'attachmentType' => $m['attachment_type'] ?? null,
        'createdAt'      => gmdate('c', (int) $m['created_ts']),
        'seenAt'         => !empty($m['seen_ts']) ? gmdate('c', (int) $m['seen_ts']) : null,
    ];
}