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
