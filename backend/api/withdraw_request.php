<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u = require_auth();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b = body();
$currency = trim($b['currency'] ?? '');
$network  = trim($b['network'] ?? '');
$amount   = isset($b['amount']) ? (float) $b['amount'] : 0;
$address  = trim($b['address'] ?? '');

$allowedCurrencies = ['BNB', 'BTC', 'ETH', 'USDT', 'SOL', 'USDC', 'XRP'];
$allowedNetworks = [
    'BNB'  => ['BNB', 'BSC (BEP20)'],
    'BTC'  => ['BTC'],
    'ETH'  => ['ERC20'],
    'USDT' => ['TRC20', 'ERC20', 'BEP20'],
    'SOL'  => ['SOL'],
    'USDC' => ['ERC20', 'SOL', 'BEP20'],
    'XRP'  => ['XRP'],
];

if ($currency === '' || $network === '' || $address === '' || $amount <= 0) {
    json_err('Currency, network, amount and recipient address are required.', 400);
}
if (!in_array($currency, $allowedCurrencies, true)) {
    json_err('Unsupported currency.', 400);
}
if (!isset($allowedNetworks[$currency]) || !in_array($network, $allowedNetworks[$currency], true)) {
    json_err('Unsupported network for selected currency.', 400);
}
if ($amount < 10) {
    json_err('Minimum withdrawal is 10.00 USDT equivalent.', 400);
}
if (strlen($address) < 8) {
    json_err('Please provide a valid recipient address.', 400);
}

$symbol = strtoupper($currency);
$stmt = db()->prepare('SELECT * FROM holdings WHERE user_id = ? AND symbol = ?');
$stmt->execute([$u['id'], $symbol]);
$holding = $stmt->fetch();
if (!$holding) {
    json_err('Insufficient balance for selected currency.', 400);
}
$currentAmount = (float) $holding['amount'];
if ($amount > $currentAmount) {
    json_err('Requested withdrawal exceeds available balance.', 400);
}

try {
    $pdo = db();
    $pdo->beginTransaction();

    if ($amount < $currentAmount) {
        db()->prepare('UPDATE holdings SET amount = ? WHERE id = ?')->execute([$currentAmount - $amount, $holding['id']]);
    } else {
        db()->prepare('DELETE FROM holdings WHERE id = ? AND user_id = ?')->execute([$holding['id'], $u['id']]);
    }

    $columns = $pdo->query("SHOW COLUMNS FROM withdraw_history LIKE 'network'")->fetch();
    if (!$columns) {
        $pdo->exec("ALTER TABLE withdraw_history ADD COLUMN network VARCHAR(80) DEFAULT NULL");
    }
    $columns = $pdo->query("SHOW COLUMNS FROM withdraw_history LIKE 'address'")->fetch();
    if (!$columns) {
        $pdo->exec("ALTER TABLE withdraw_history ADD COLUMN address VARCHAR(255) DEFAULT NULL");
    }

    log_withdraw($u['id'], $amount, $currency, $network, $address, null, null, 'pending');
    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    json_err('Failed to submit withdrawal request.', 500);
}
json_out(['ok' => true], 201);
