<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u = require_auth();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b = body();
$coinId = trim($b['coinId'] ?? '');
$symbol = trim($b['symbol'] ?? '');
$name   = trim($b['name'] ?? '');
$amount = isset($b['amount']) ? (float) $b['amount'] : 0;
// Client-supplied live USD price for this coin — this backend has no price
// feed of its own, matching every other endpoint here (Trade, Withdraw…).
$price  = isset($b['price']) ? (float) $b['price'] : 0;

if ($coinId === '' || $amount <= 0 || $price <= 0) {
    json_err('coinId, a positive amount and a positive price are required.', 400);
}
if ($coinId === 'tether') {
    json_err('USDT cannot be converted to itself.', 400);
}

$stmt = db()->prepare('SELECT * FROM holdings WHERE user_id = ? AND coin_id = ?');
$stmt->execute([$u['id'], $coinId]);
$holding = $stmt->fetch();
if (!$holding) json_err('You do not hold this coin.', 400);

$currentAmount = (float) $holding['amount'];
if ($amount > $currentAmount) json_err('Requested amount exceeds your holding.', 400);

$usdValue = $amount * $price;

try {
    $pdo = db();
    $pdo->beginTransaction();

    if ($amount < $currentAmount) {
        $pdo->prepare('UPDATE holdings SET amount = ? WHERE id = ?')->execute([$currentAmount - $amount, $holding['id']]);
    } else {
        $pdo->prepare('DELETE FROM holdings WHERE id = ? AND user_id = ?')->execute([$holding['id'], $u['id']]);
    }
    log_trade(
        (int) $u['id'], 'remove', $coinId, $symbol ?: $holding['symbol'], $name ?: $holding['name'],
        $amount, $price
    );

    // add_or_merge_holding logs its own 'add' trade-history row for the USDT side.
    add_or_merge_holding(
        (int) $u['id'], 'tether', 'usdt', 'Tether',
        'https://coin-images.coingecko.com/coins/images/325/large/Tether.png?1696501661',
        $usdValue, 1.0
    );

    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    json_err('Conversion failed.', 500);
}

json_out(['ok' => true, 'usdValue' => $usdValue]);
