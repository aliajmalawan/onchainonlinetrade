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
