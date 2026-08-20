<?php
/**
 * ============================================================
 *  OnChainTrade — Backend Scaffolder
 * ------------------------------------------------------------
 *  Save this file in your project root (next to the frontend),
 *  open the VS Code terminal, and run:
 *
 *      php scaffold.php
 *
 *  It creates a complete PHP + MySQL backend in ./backend and
 *  prints the next steps. Re-running it will NOT overwrite files
 *  that already exist (safe). Use  php scaffold.php --force  to
 *  overwrite everything.
 * ============================================================
 */

$FORCE = in_array('--force', $argv, true);
$ROOT  = __DIR__ . '/backend';

$files = [];

/* ---------------- config.php ---------------- */
$files['config.php'] = <<<'PHP'
<?php
/**
 * Edit these to match your MySQL / XAMPP setup.
 * XAMPP defaults: user "root", empty password.
 */
define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');
define('DB_NAME', 'cryptotrack');
define('DB_USER', 'root');
define('DB_PASS', '');            // XAMPP default is empty

// Frontend origins allowed to call this API (CORS).
// Add your Vite dev URL and, later, your production domain.
define('ALLOWED_ORIGINS', [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]);

// How long a login token stays valid (seconds). Default: 7 days.
define('TOKEN_TTL', 7 * 24 * 60 * 60);
PHP;

/* ---------------- db.php ---------------- */
$files['db.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/config.php';

/** Single shared PDO connection. */
function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT
             . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode([
                'error' => 'Database connection failed. Is MySQL running? '
                         . 'Have you run setup_db.php?',
            ]);
            exit;
        }
    }
    return $pdo;
}
PHP;

/* ---------------- helpers.php ---------------- */
$files['helpers.php'] = <<<'PHP'
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

/** Create a token row for a user and return the token string. */
function issue_token(int $userId): string
{
    $token   = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', time() + TOKEN_TTL);
    db()->prepare('INSERT INTO tokens (token, user_id, expires_at) VALUES (?, ?, ?)')
        ->execute([$token, $userId, $expires]);
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
    return [
        'id'        => (int) $u['id'],
        'name'      => $u['name'],
        'email'     => $u['email'],
        'role'      => $u['role'],
        'createdAt' => $u['created_at'],
    ];
}

/**
 * Add a holding for a user, merging into an existing row for the same coin
 * (amount summed, buy price weighted-averaged) instead of creating a
 * duplicate line. Returns the affected holding's id.
 */
function add_or_merge_holding(int $userId, string $coinId, string $symbol, string $name, ?string $image, float $amount, float $buyPrice): int
{
    $stmt = db()->prepare('SELECT * FROM holdings WHERE user_id = ? AND coin_id = ?');
    $stmt->execute([$userId, $coinId]);
    $existing = $stmt->fetch();

    if ($existing) {
        $oldAmount   = (float) $existing['amount'];
        $newAmount   = $oldAmount + $amount;
        $newBuyPrice = (($oldAmount * (float) $existing['buy_price']) + ($amount * $buyPrice)) / $newAmount;

        db()->prepare('UPDATE holdings SET amount = ?, buy_price = ?, symbol = ?, name = ?, image = ? WHERE id = ?')
            ->execute([$newAmount, $newBuyPrice, $symbol, $name, $image, $existing['id']]);

        log_trade($userId, 'add', $coinId, $symbol, $name, $amount, $buyPrice);
        return (int) $existing['id'];
    }

    $stmt = db()->prepare(
        'INSERT INTO holdings (user_id, coin_id, symbol, name, image, amount, buy_price)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$userId, $coinId, $symbol, $name, $image, $amount, $buyPrice]);
    $newId = (int) db()->lastInsertId();

    log_trade($userId, 'add', $coinId, $symbol, $name, $amount, $buyPrice);
    return $newId;
}

/** Record a row in the user's trade/activity history. */
function log_trade(int $userId, string $action, string $coinId, string $symbol, string $name, float $amount, float $price): void
{
    db()->prepare(
        'INSERT INTO trade_history (user_id, action, coin_id, symbol, name, amount, price)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    )->execute([$userId, $action, $coinId, $symbol, $name, $amount, $price]);
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
        'id'        => (int) $t['id'],
        'action'    => $t['action'],
        'coinId'    => $t['coin_id'],
        'symbol'    => $t['symbol'],
        'name'      => $t['name'],
        'amount'    => (float) $t['amount'],
        'price'     => (float) $t['price'],
        'createdAt' => $t['created_at'],
    ];
}

/** Shape a support-chat message row for the client. */
function public_message(array $m): array
{
    return [
        'id'        => (int) $m['id'],
        'userId'    => (int) $m['user_id'],
        'sender'    => $m['sender'],
        'message'   => $m['message'],
        'createdAt' => $m['created_at'],
    ];
}
PHP;

/* ---------------- setup_db.php ---------------- */
$files['setup_db.php'] = <<<'PHP'
<?php
/**
 * Creates the database, tables, and a demo admin.
 * Run once from the terminal:   php setup_db.php
 */
require_once __DIR__ . '/config.php';

// Connect WITHOUT selecting a database so we can create it.
$dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';charset=utf8mb4';
try {
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (PDOException $e) {
    exit("\n[x] Can't connect to MySQL: " . $e->getMessage()
        . "\n    Is XAMPP MySQL running? Check credentials in config.php\n\n");
}

$pdo->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "`
            CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$pdo->exec("USE `" . DB_NAME . "`");

$pdo->exec("
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('user','admin') NOT NULL DEFAULT 'user',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB");

$pdo->exec("
CREATE TABLE IF NOT EXISTS tokens (
    token      CHAR(64) PRIMARY KEY,
    user_id    INT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

$pdo->exec("
CREATE TABLE IF NOT EXISTS holdings (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    coin_id    VARCHAR(80)  NOT NULL,
    symbol     VARCHAR(30)  NOT NULL,
    name       VARCHAR(120) NOT NULL,
    image      VARCHAR(255) DEFAULT NULL,
    amount     DECIMAL(30,10) NOT NULL,
    buy_price  DECIMAL(30,10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

$pdo->exec("
CREATE TABLE IF NOT EXISTS trade_history (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    action     ENUM('add','update','remove') NOT NULL,
    coin_id    VARCHAR(80)  NOT NULL,
    symbol     VARCHAR(30)  NOT NULL,
    name       VARCHAR(120) NOT NULL,
    amount     DECIMAL(30,10) NOT NULL,
    price      DECIMAL(30,10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

$pdo->exec("
CREATE TABLE IF NOT EXISTS support_messages (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    sender     ENUM('user','admin') NOT NULL,
    message    TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

echo "[ok] Tables ready.\n";

// Seed a demo admin (same credentials as the frontend demo).
$email = 'ghk171854@gmail.com';
$stmt  = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);

if (!$stmt->fetch()) {
    $hash = password_hash('admin123', PASSWORD_DEFAULT);
    $pdo->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
        ->execute(['Super Admin', $email, $hash, 'admin']);
    echo "[ok] Seeded demo admin -> ghk171854@gmail.com / admin123\n";
} else {
    echo "[i] Admin already exists, skipping seed.\n";
}

echo "[ok] Database setup complete.\n";
PHP;

/* ---------------- .htaccess ---------------- */
$files['.htaccess'] = <<<'HTA'
# Pass the Authorization header through to PHP (needed under Apache/LiteSpeed).
RewriteEngine On
RewriteCond %{HTTP:Authorization} ^(.+)$
RewriteRule .* - [E=HTTP_AUTHORIZATION:%1]

# Don't list directory contents.
Options -Indexes
HTA;

/* ---------------- api/register.php ---------------- */
$files['api/register.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b        = body();
$name     = trim($b['name'] ?? '');
$email    = trim($b['email'] ?? '');
$password = (string) ($b['password'] ?? '');

if ($name === '' || $email === '' || strlen($password) < 4) {
    json_err('Name, email and a 4+ character password are required.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_err('Please enter a valid email.');
}

try {
    db()->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
        ->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), 'user']);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') json_err('An account with this email already exists.', 409);
    json_err('Could not create account.', 500);
}

$id   = (int) db()->lastInsertId();
$user = db()->query('SELECT * FROM users WHERE id = ' . $id)->fetch();
json_out(['token' => issue_token($id), 'user' => public_user($user)], 201);
PHP;

/* ---------------- api/login.php ---------------- */
$files['api/login.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b        = body();
$email    = trim($b['email'] ?? '');
$password = (string) ($b['password'] ?? '');

$stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    json_err('Incorrect email or password.', 401);
}

json_out(['token' => issue_token((int) $user['id']), 'user' => public_user($user)]);
PHP;

/* ---------------- api/logout.php ---------------- */
$files['api/logout.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../helpers.php';
cors();

$token = bearer_token();
if ($token) {
    db()->prepare('DELETE FROM tokens WHERE token = ?')->execute([$token]);
}
json_out(['ok' => true]);
PHP;

/* ---------------- api/me.php ---------------- */
$files['api/me.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u = require_auth();
json_out(['user' => public_user($u)]);
PHP;

/* ---------------- api/portfolio.php ---------------- */
$files['api/portfolio.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u      = require_auth();
$method = $_SERVER['REQUEST_METHOD'];

// GET -> list this user's holdings
if ($method === 'GET') {
    $stmt = db()->prepare('SELECT * FROM holdings WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$u['id']]);
    json_out(['holdings' => array_map('public_holding', $stmt->fetchAll())]);
}

// POST -> add a holding
if ($method === 'POST') {
    $b        = body();
    $coinId   = trim($b['coinId'] ?? '');
    $symbol   = trim($b['symbol'] ?? '');
    $name     = trim($b['name'] ?? '');
    $image    = $b['image'] ?? null;
    $amount   = (float) ($b['amount'] ?? 0);
    $buyPrice = (float) ($b['buyPrice'] ?? 0);

    if ($coinId === '' || $amount <= 0 || $buyPrice <= 0) {
        json_err('coinId, a positive amount and a positive buyPrice are required.');
    }

    $id  = add_or_merge_holding($u['id'], $coinId, $symbol, $name, $image, $amount, $buyPrice);
    $row = db()->query('SELECT * FROM holdings WHERE id = ' . $id)->fetch();
    json_out(['holding' => public_holding($row)], 201);
}

// DELETE -> sell/remove a holding (?id=123). Body may include {amount, price}
// for a partial sell (a "Trade" action) — omit amount to remove it entirely.
if ($method === 'DELETE') {
    $id        = (int) ($_GET['id'] ?? 0);
    $b         = body();
    $sellAmt   = isset($b['amount']) ? (float) $b['amount'] : null;
    $sellPrice = isset($b['price']) ? (float) $b['price'] : null;

    $stmt = db()->prepare('SELECT * FROM holdings WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $u['id']]);
    $row = $stmt->fetch();

    if ($row) {
        $currentAmount = (float) $row['amount'];
        $loggedPrice   = $sellPrice ?? (float) $row['buy_price'];

        if ($sellAmt !== null && $sellAmt > 0 && $sellAmt < $currentAmount) {
            $remaining = $currentAmount - $sellAmt;
            db()->prepare('UPDATE holdings SET amount = ? WHERE id = ?')->execute([$remaining, $id]);
            log_trade((int) $u['id'], 'remove', $row['coin_id'], $row['symbol'], $row['name'], $sellAmt, $loggedPrice);
        } else {
            db()->prepare('DELETE FROM holdings WHERE id = ? AND user_id = ?')->execute([$id, $u['id']]);
            log_trade((int) $u['id'], 'remove', $row['coin_id'], $row['symbol'], $row['name'], $currentAmount, $loggedPrice);
        }
    }
    json_out(['ok' => true]);
}

json_err('Method not allowed', 405);
PHP;

/* ---------------- api/update_password.php ---------------- */
$files['api/update_password.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u = require_auth();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b       = body();
$current = (string) ($b['currentPassword'] ?? '');
$next    = (string) ($b['newPassword'] ?? '');

if (!password_verify($current, $u['password_hash'])) {
    json_err('Current password is incorrect.', 401);
}
if (strlen($next) < 4) {
    json_err('New password must be at least 4 characters.');
}

db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    ->execute([password_hash($next, PASSWORD_DEFAULT), $u['id']]);

json_out(['ok' => true]);
PHP;

/* ---------------- api/update_account.php ---------------- */
$files['api/update_account.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u = require_auth();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b     = body();
$name  = trim($b['name'] ?? '');
$email = trim($b['email'] ?? '');

if ($name === '' || $email === '') json_err('Name and email are required.');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_err('Please enter a valid email.');

try {
    db()->prepare('UPDATE users SET name = ?, email = ? WHERE id = ?')
        ->execute([$name, $email, $u['id']]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') json_err('An account with this email already exists.', 409);
    json_err('Could not update account.', 500);
}

$row = db()->query('SELECT * FROM users WHERE id = ' . (int) $u['id'])->fetch();
json_out(['user' => public_user($row)]);
PHP;

/* ---------------- api/trade_history.php ---------------- */
$files['api/trade_history.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u = require_auth();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_err('Method not allowed', 405);

$stmt = db()->prepare('SELECT * FROM trade_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 200');
$stmt->execute([$u['id']]);
json_out(['trades' => array_map('public_trade', $stmt->fetchAll())]);
PHP;

/* ---------------- api/support_chat.php ---------------- */
$files['api/support_chat.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u      = require_auth();
$method = $_SERVER['REQUEST_METHOD'];

// GET -> this user's own conversation with support
if ($method === 'GET') {
    $stmt = db()->prepare('SELECT * FROM support_messages WHERE user_id = ? ORDER BY created_at ASC');
    $stmt->execute([$u['id']]);
    json_out(['messages' => array_map('public_message', $stmt->fetchAll())]);
}

// POST -> send a message to support
if ($method === 'POST') {
    $b       = body();
    $message = trim($b['message'] ?? '');
    if ($message === '') json_err('Message cannot be empty.');

    db()->prepare('INSERT INTO support_messages (user_id, sender, message) VALUES (?, ?, ?)')
        ->execute([$u['id'], 'user', $message]);

    $row = db()->query('SELECT * FROM support_messages WHERE id = ' . (int) db()->lastInsertId())->fetch();
    json_out(['message' => public_message($row)], 201);
}

json_err('Method not allowed', 405);
PHP;

/* ---------------- api/admin/users.php ---------------- */
$files['api/admin/users.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

$rows = db()->query('SELECT * FROM users ORDER BY created_at DESC')->fetchAll();
json_out(['users' => array_map('public_user', $rows)]);
PHP;

/* ---------------- api/admin/update_role.php ---------------- */
$files['api/admin/update_role.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

// Roles are fixed: exactly one super admin, everyone else is a standard
// user. There is no path — UI or API — to create a second admin.
json_err('Role changes are disabled. There is a single fixed super admin account.', 403);
PHP;

/* ---------------- api/admin/add_holding.php ---------------- */
$files['api/admin/add_holding.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b        = body();
$userId   = (int) ($b['userId'] ?? 0);
$coinId   = trim($b['coinId'] ?? '');
$symbol   = trim($b['symbol'] ?? '');
$name     = trim($b['name'] ?? '');
$image    = $b['image'] ?? null;
$amount   = (float) ($b['amount'] ?? 0);
$buyPrice = (float) ($b['buyPrice'] ?? 0);

if ($userId <= 0 || $coinId === '' || $amount <= 0 || $buyPrice <= 0) {
    json_err('userId, coinId, a positive amount and a positive buyPrice are required.');
}

$stmt = db()->prepare('SELECT id FROM users WHERE id = ?');
$stmt->execute([$userId]);
if (!$stmt->fetch()) json_err('User not found.', 404);

$id  = add_or_merge_holding($userId, $coinId, $symbol, $name, $image, $amount, $buyPrice);
$row = db()->query('SELECT * FROM holdings WHERE id = ' . $id)->fetch();
json_out(['holding' => public_holding($row)], 201);
PHP;

/* ---------------- api/admin/delete_user.php ---------------- */
$files['api/admin/delete_user.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../../helpers.php';
cors();

$me = require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b      = body();
$userId = (int) ($b['userId'] ?? 0);

if ($userId === (int) $me['id']) json_err("You can't delete your own account.", 400);

// holdings + tokens are removed automatically via ON DELETE CASCADE.
db()->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);
json_out(['ok' => true]);
PHP;

/* ---------------- api/admin/user_holdings.php ---------------- */
$files['api/admin/user_holdings.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_err('Method not allowed', 405);

$userId = (int) ($_GET['userId'] ?? 0);
if ($userId <= 0) json_err('userId is required.');

$stmt = db()->prepare('SELECT * FROM holdings WHERE user_id = ? ORDER BY created_at DESC');
$stmt->execute([$userId]);
json_out(['holdings' => array_map('public_holding', $stmt->fetchAll())]);
PHP;

/* ---------------- api/admin/update_holding.php ---------------- */
$files['api/admin/update_holding.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b         = body();
$holdingId = (int) ($b['holdingId'] ?? 0);
$amount    = (float) ($b['amount'] ?? 0);

if ($holdingId <= 0) json_err('holdingId is required.');
if (!($amount > 0)) json_err('Amount must be greater than 0 — use the delete endpoint to remove a holding entirely.');

$stmt = db()->prepare('SELECT * FROM holdings WHERE id = ?');
$stmt->execute([$holdingId]);
$row = $stmt->fetch();
if (!$row) json_err('Holding not found.', 404);

db()->prepare('UPDATE holdings SET amount = ? WHERE id = ?')->execute([$amount, $holdingId]);
log_trade((int) $row['user_id'], 'update', $row['coin_id'], $row['symbol'], $row['name'], $amount, (float) $row['buy_price']);

$row['amount'] = $amount;
json_out(['holding' => public_holding($row)]);
PHP;

/* ---------------- api/admin/delete_holding.php ---------------- */
$files['api/admin/delete_holding.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b         = body();
$holdingId = (int) ($b['holdingId'] ?? 0);

if ($holdingId <= 0) json_err('holdingId is required.');

$stmt = db()->prepare('SELECT * FROM holdings WHERE id = ?');
$stmt->execute([$holdingId]);
$row = $stmt->fetch();

if ($row) {
    db()->prepare('DELETE FROM holdings WHERE id = ?')->execute([$holdingId]);
    log_trade((int) $row['user_id'], 'remove', $row['coin_id'], $row['symbol'], $row['name'], (float) $row['amount'], (float) $row['buy_price']);
}
json_out(['ok' => true]);
PHP;

/* ---------------- api/admin/impersonate.php ---------------- */
$files['api/admin/impersonate.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b      = body();
$userId = (int) ($b['userId'] ?? 0);
if ($userId <= 0) json_err('userId is required.');

$stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();
if (!$user) json_err('User not found.', 404);

// Issues a fresh session token for the target user. The admin never sees
// or needs the user's password — this is a support-style "login as" swap.
json_out(['token' => issue_token($userId), 'user' => public_user($user)]);
PHP;

/* ---------------- api/admin/support_chats.php ---------------- */
$files['api/admin/support_chats.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_err('Method not allowed', 405);

// One row per user who has ever messaged support, with a preview of their
// latest message, most recently active first.
$rows = db()->query("
    SELECT u.id, u.name, u.email,
           m.message      AS last_message,
           m.sender        AS last_sender,
           m.created_at    AS last_at
    FROM users u
    JOIN support_messages m ON m.user_id = u.id
    JOIN (
        SELECT user_id, MAX(created_at) AS max_at
        FROM support_messages
        GROUP BY user_id
    ) latest ON latest.user_id = m.user_id AND latest.max_at = m.created_at
    ORDER BY m.created_at DESC
")->fetchAll();

json_out(['conversations' => array_map(function ($r) {
    return [
        'userId'      => (int) $r['id'],
        'name'        => $r['name'],
        'email'       => $r['email'],
        'lastMessage' => $r['last_message'],
        'lastSender'  => $r['last_sender'],
        'lastAt'      => $r['last_at'],
    ];
}, $rows)]);
PHP;

/* ---------------- api/admin/support_chat.php ---------------- */
$files['api/admin/support_chat.php'] = <<<'PHP'
<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

$method = $_SERVER['REQUEST_METHOD'];

// GET ?userId=123 -> full thread with one user
if ($method === 'GET') {
    $userId = (int) ($_GET['userId'] ?? 0);
    if ($userId <= 0) json_err('userId is required.');

    $stmt = db()->prepare('SELECT * FROM support_messages WHERE user_id = ? ORDER BY created_at ASC');
    $stmt->execute([$userId]);
    json_out(['messages' => array_map('public_message', $stmt->fetchAll())]);
}

// POST -> reply to a user as support
if ($method === 'POST') {
    $b       = body();
    $userId  = (int) ($b['userId'] ?? 0);
    $message = trim($b['message'] ?? '');

    if ($userId <= 0) json_err('userId is required.');
    if ($message === '') json_err('Message cannot be empty.');

    $stmt = db()->prepare('SELECT id FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    if (!$stmt->fetch()) json_err('User not found.', 404);

    db()->prepare('INSERT INTO support_messages (user_id, sender, message) VALUES (?, ?, ?)')
        ->execute([$userId, 'admin', $message]);

    $row = db()->query('SELECT * FROM support_messages WHERE id = ' . (int) db()->lastInsertId())->fetch();
    json_out(['message' => public_message($row)], 201);
}

json_err('Method not allowed', 405);
PHP;

/* ---------------- frontend-integration/api.js ---------------- */
$files['frontend-integration/api.js'] = <<<'JS'
/**
 * Drop-in backend client for the React app.
 * Copy this file to  src/lib/backend.js  and use it to replace the
 * localStorage mock in storage.js / AuthContext.jsx.
 *
 * All calls return promises, so the components that used the sync
 * localStorage helpers need small async tweaks (await + loading state).
 */

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000/api'

function token() {
  return localStorage.getItem('ct.token')
}

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: 'Bearer ' + token() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// --- Auth ---
export async function apiRegister(payload) {
  const { token: t, user } = await request('/register.php', { method: 'POST', body: payload })
  localStorage.setItem('ct.token', t)
  return user
}

export async function apiLogin(email, password) {
  const { token: t, user } = await request('/login.php', { method: 'POST', body: { email, password } })
  localStorage.setItem('ct.token', t)
  return user
}

export async function apiLogout() {
  try { await request('/logout.php', { method: 'POST' }) } finally {
    localStorage.removeItem('ct.token')
  }
}

export async function apiMe() {
  if (!token()) return null
  try {
    const { user } = await request('/me.php')
    return user
  } catch {
    localStorage.removeItem('ct.token')
    return null
  }
}

// --- Portfolio ---
export const apiGetPortfolio = () => request('/portfolio.php').then((d) => d.holdings)
export const apiAddHolding   = (h) => request('/portfolio.php', { method: 'POST', body: h }).then((d) => d.holding)
export const apiRemoveHolding = (id, opts) => request('/portfolio.php?id=' + id, { method: 'DELETE', body: opts })
export const apiGetTradeHistory = () => request('/trade_history.php').then((d) => d.trades)

// --- Account ---
export const apiUpdatePassword = (currentPassword, newPassword) => request('/update_password.php', { method: 'POST', body: { currentPassword, newPassword } })
export const apiUpdateAccount  = (name, email) => request('/update_account.php', { method: 'POST', body: { name, email } }).then((d) => d.user)

// --- Support chat ---
export const apiGetSupportChat  = () => request('/support_chat.php').then((d) => d.messages)
export const apiSendSupportChat = (message) => request('/support_chat.php', { method: 'POST', body: { message } }).then((d) => d.message)

// --- Admin ---
export const apiGetUsers    = () => request('/admin/users.php').then((d) => d.users)
export const apiDeleteUser  = (userId) => request('/admin/delete_user.php', { method: 'POST', body: { userId } })
export const apiAdminAddHolding = (userId, h) => request('/admin/add_holding.php', { method: 'POST', body: { userId, ...h } }).then((d) => d.holding)
export const apiAdminGetUserHoldings = (userId) => request('/admin/user_holdings.php?userId=' + userId).then((d) => d.holdings)
export const apiAdminUpdateHolding = (holdingId, amount) => request('/admin/update_holding.php', { method: 'POST', body: { holdingId, amount } }).then((d) => d.holding)
export const apiAdminDeleteHolding = (holdingId) => request('/admin/delete_holding.php', { method: 'POST', body: { holdingId } })
export const apiAdminImpersonate = (userId) => request('/admin/impersonate.php', { method: 'POST', body: { userId } })
export const apiAdminGetChats   = () => request('/admin/support_chats.php').then((d) => d.conversations)
export const apiAdminGetChat    = (userId) => request('/admin/support_chat.php?userId=' + userId).then((d) => d.messages)
export const apiAdminSendChat   = (userId, message) => request('/admin/support_chat.php', { method: 'POST', body: { userId, message } }).then((d) => d.message)
JS;

/* ---------------- README-backend.md ---------------- */
$files['README-backend.md'] = <<<'MD'
# OnChainTrade — Backend (PHP + MySQL)

A small, framework-free REST API for the OnChainTrade React app. Token-based
auth (no PHP sessions — avoids the whole session/output-buffering headache),
hashed passwords, and clean PDO prepared statements.

## Setup

1. **Start MySQL** (XAMPP Control Panel -> Start MySQL).
2. **Configure** `config.php` if your MySQL user/password differ from XAMPP's
   defaults (`root` / empty password).
3. **Create the database + demo admin:**
   ```bash
   php setup_db.php
   ```
4. **Run the API** (from the project root, so the path points at ./backend):
   ```bash
   php -S localhost:8000 -t backend
   ```
   The API is now at `http://localhost:8000/api/...`

## Endpoints

| Method | Path                          | Auth   | Purpose                    |
| ------ | ----------------------------- | ------ | -------------------------- |
| POST   | /api/register.php             | –      | Create account, get token  |
| POST   | /api/login.php                | –      | Log in, get token          |
| POST   | /api/logout.php               | token  | Invalidate token           |
| GET    | /api/me.php                   | token  | Current user               |
| GET    | /api/portfolio.php            | token  | List holdings              |
| POST   | /api/portfolio.php            | token  | Add a holding (merges into an existing row for the same coin — amount summed, buy price weighted-averaged) |
| DELETE | /api/portfolio.php?id=123     | token  | Sell/remove a holding — body `{amount, price}` sells part of it (a Trade), omit to remove it entirely |
| GET    | /api/trade_history.php        | token  | Your own add/update/remove activity log |
| GET    | /api/withdraw_history.php     | token  | Your withdrawals history |
| POST   | /api/update_password.php      | token  | Change your own password (requires current password) |
| POST   | /api/update_account.php       | token  | Update your own name/email |
| GET    | /api/support_chat.php         | token  | Your own support chat thread |
| POST   | /api/support_chat.php         | token  | Send a message to support  |
| GET    | /api/admin/users.php          | admin  | List all users             |
| POST   | /api/admin/update_role.php    | admin  | Disabled — always 403. Roles are fixed (one super admin, rest are users) |
| POST   | /api/admin/delete_user.php    | admin  | Delete a user              |
| POST   | /api/admin/add_holding.php    | admin  | Add a holding to a user's portfolio (same merge behavior as above) |
| GET    | /api/admin/user_holdings.php?userId=1 | admin | List a user's holdings |
| POST   | /api/admin/update_holding.php | admin  | Adjust a holding's amount (record correction, not a transfer) |
| POST   | /api/admin/delete_holding.php | admin  | Remove a holding entirely  |
| POST   | /api/admin/impersonate.php    | admin  | Get a session token for a user ("login as") — never touches their password |
| GET    | /api/admin/support_chats.php  | admin  | List conversations, newest activity first |
| GET    | /api/admin/support_chat.php?userId=1 | admin | Full thread with one user |
| POST   | /api/admin/support_chat.php   | admin  | Reply to a user as support |

Send the token as a header:  `Authorization: Bearer <token>`

## Connect the React frontend

1. Copy `frontend-integration/api.js` into the React app at `src/lib/backend.js`.
2. Add to the frontend `.env`:
   ```
   VITE_BACKEND_URL=http://localhost:8000/api
   ```
3. Replace the localStorage calls in `AuthContext.jsx` and the portfolio/admin
   pages with the async `api*` functions (add `await` + a little loading state).
   Ask Claude Code: "wire AuthContext and the pages to src/lib/backend.js".

## Security notes (this is now the real thing)

- Passwords are hashed with `password_hash()` — never stored in plain text.
- Tokens are random 32-byte values with an expiry; logout deletes them.
- All queries use prepared statements (no SQL injection).
- CORS is limited to the origins in `config.php` — tighten these in production.
- For production: serve over HTTPS, set a strong DB password, and consider
  rate-limiting the login endpoint.
MD;

/* ============================================================
 *  Write everything out
 * ============================================================ */
echo "\n  OnChainTrade backend scaffolder\n";
echo "  --------------------------------\n";

$created = 0;
$skipped = 0;

foreach ($files as $rel => $content) {
    $path = $ROOT . '/' . $rel;
    $dir  = dirname($path);

    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }

    if (file_exists($path) && !$FORCE) {
        echo "  [skip]    backend/$rel (already exists)\n";
        $skipped++;
        continue;
    }

    file_put_contents($path, $content);
    echo "  [created] backend/$rel\n";
    $created++;
}

echo "\n  Done. $created created, $skipped skipped.\n\n";
echo "  Next steps:\n";
echo "    1. Start MySQL in XAMPP\n";
echo "    2. php backend/setup_db.php        (creates DB + demo admin)\n";
echo "    3. php -S localhost:8000 -t backend\n";
echo "    4. API is live at http://localhost:8000/api\n\n";
echo "  Then wire the frontend using backend/frontend-integration/api.js\n";
echo "  (see backend/README-backend.md).\n\n";
