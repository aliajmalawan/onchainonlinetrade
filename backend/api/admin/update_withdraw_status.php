<?php
require_once __DIR__ . '/../../helpers.php';
cors();
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b = body();
$withdrawId = isset($b['withdrawId']) ? (int) $b['withdrawId'] : 0;
$status = trim($b['status'] ?? '');
$txId = trim($b['txId'] ?? '');
$fee = isset($b['fee']) && $b['fee'] !== '' ? (float) $b['fee'] : null;

if ($withdrawId <= 0) json_err('withdrawId is required.', 400);
if (!in_array($status, ['pending', 'completed', 'failed'], true)) json_err('Invalid status.', 400);

$stmt = db()->prepare('SELECT * FROM withdraw_history WHERE id = ?');
$stmt->execute([$withdrawId]);
$withdraw = $stmt->fetch();
if (!$withdraw) json_err('Withdrawal request not found.', 404);

$fields = ['status = ?'];
$params = [$status];
if ($txId !== '') {
    $fields[] = 'tx_id = ?';
    $params[] = $txId;
}
if ($fee !== null) {
    $fields[] = 'fee = ?';
    $params[] = $fee;
}
$params[] = $withdrawId;

$stmt = db()->prepare('UPDATE withdraw_history SET ' . implode(', ', $fields) . ' WHERE id = ?');
$stmt->execute($params);

$stmt = db()->prepare(
    'SELECT w.*, u.name AS user_name, u.email AS user_email
     FROM withdraw_history w
     JOIN users u ON u.id = w.user_id
     WHERE w.id = ?'
);
$stmt->execute([$withdrawId]);
$updated = $stmt->fetch();
if (!$updated) json_err('Withdrawal request not found after update.', 404);

json_out(['withdraw' => [
    'id'        => (int) $updated['id'],
    'userId'    => (int) $updated['user_id'],
    'userName'  => $updated['user_name'],
    'userEmail' => $updated['user_email'],
    'amount'    => (float) $updated['amount'],
    'currency'  => $updated['currency'],
    'network'   => $updated['network'] ?? null,
    'address'   => $updated['address'] ?? null,
    'fee'       => isset($updated['fee']) ? (float) $updated['fee'] : null,
    'txId'      => $updated['tx_id'] ?? null,
    'status'    => $updated['status'],
    'createdAt' => $updated['created_at'],
]]);
