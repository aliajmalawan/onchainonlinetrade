<?php
require_once __DIR__ . '/../../helpers.php';
cors();
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b = body();
$depositId = isset($b['depositId']) ? (int) $b['depositId'] : 0;
$status = trim($b['status'] ?? '');
$txId = trim($b['txId'] ?? '');
// The user no longer submits an amount — the admin sets it here (from the
// transaction screenshot) before/while marking the request completed.
$amount = isset($b['amount']) && $b['amount'] !== '' ? (float) $b['amount'] : null;

if ($depositId <= 0) json_err('depositId is required.', 400);
if (!in_array($status, ['pending', 'completed', 'failed'], true)) json_err('Invalid status.', 400);
if ($amount !== null && $amount < 0) json_err('Amount cannot be negative.', 400);

$stmt = db()->prepare('SELECT * FROM deposit_requests WHERE id = ?');
$stmt->execute([$depositId]);
$deposit = $stmt->fetch();
if (!$deposit) json_err('Deposit request not found.', 404);

// Only credit holdings the moment a request first becomes completed —
// never on a later re-save, so re-selecting "completed" can't double-credit.
$newlyCompleted = $status === 'completed' && $deposit['status'] !== 'completed';
if ($newlyCompleted && ($amount ?? (float) $deposit['amount']) <= 0) {
    json_err('Enter the deposit amount before marking this request completed.', 400);
}

$fields = ['status = ?'];
$params = [$status];
if ($txId !== '') {
    $fields[] = 'tx_id = ?';
    $params[] = $txId;
}
if ($amount !== null) {
    $fields[] = 'amount = ?';
    $params[] = $amount;
    $deposit['amount'] = $amount; // keep the crediting logic below in sync
}
$params[] = $depositId;

try {
    $pdo = db();
    $pdo->beginTransaction();

    $pdo->prepare('UPDATE deposit_requests SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);

    if ($newlyCompleted) {
        // buy_price is fixed at 1.0 — accurate for the stablecoins this
        // started with; a non-stablecoin currency added later would need a
        // real price source to credit at a realistic value.
        $meta = deposit_coin_meta($deposit['currency']);
        add_or_merge_holding(
            (int) $deposit['user_id'],
            $meta['coinId'],
            $meta['symbol'],
            $meta['name'],
            $meta['image'],
            (float) $deposit['amount'],
            1.0
        );
    }

    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    json_err('Failed to update deposit request.', 500);
}

$stmt = db()->prepare(
    'SELECT d.*, u.name AS user_name, u.email AS user_email
     FROM deposit_requests d
     JOIN users u ON u.id = d.user_id
     WHERE d.id = ?'
);
$stmt->execute([$depositId]);
$updated = $stmt->fetch();
if (!$updated) json_err('Deposit request not found after update.', 404);

json_out(['deposit' => [
    'id'        => (int) $updated['id'],
    'userId'    => (int) $updated['user_id'],
    'userName'  => $updated['user_name'],
    'userEmail' => $updated['user_email'],
    'amount'    => (float) $updated['amount'],
    'currency'  => $updated['currency'],
    'network'   => $updated['network'] ?? null,
    'address'   => $updated['address'] ?? null,
    'txId'      => $updated['tx_id'] ?? null,
    'txProofImage' => $updated['tx_proof_image'] ?? null,
    'status'    => $updated['status'],
    'createdAt' => $updated['created_at'],
]]);
