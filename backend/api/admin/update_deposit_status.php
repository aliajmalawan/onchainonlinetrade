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

// The user's holding carries a deposit's amount only while the request is
// "completed". Crediting the difference between what is credited now and
// what should be credited after this save means: rejecting (or re-opening)
// a completed request takes the amount back, re-saving "completed" never
// double-credits, and editing a completed amount only moves the difference.
$wasCompleted   = $deposit['status'] === 'completed';
$creditedBefore = $wasCompleted ? (float) $deposit['amount'] : 0.0;
$creditedAfter  = $status === 'completed' ? ($amount ?? (float) $deposit['amount']) : 0.0;
$creditDelta    = $creditedAfter - $creditedBefore;

if ($status === 'completed' && $creditedAfter <= 0) {
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

    // Deposits are always credited as USDT, whatever coin/network the user
    // sent: the admin enters the USDT value of the transfer as the amount.
    $meta = deposit_coin_meta('USDT');
    $userId = (int) $deposit['user_id'];

    if ($creditDelta > 0) {
        // buy_price 1.0: the credit is always USDT.
        add_or_merge_holding($userId, $meta['coinId'], $meta['symbol'], $meta['name'], $meta['image'], $creditDelta, 1.0);
    } elseif ($creditDelta < 0) {
        $takeBack = -$creditDelta;
        $stmt = $pdo->prepare('SELECT * FROM holdings WHERE user_id = ? AND coin_id = ? FOR UPDATE');
        $stmt->execute([$userId, $meta['coinId']]);
        $holding = $stmt->fetch();
        $currentAmount = $holding ? (float) $holding['amount'] : 0.0;

        // The user may already have traded/withdrawn the credited funds —
        // refuse rather than leave a negative balance.
        if ($currentAmount + 1e-9 < $takeBack) {
            $pdo->rollBack();
            json_err(
                'Cannot take back ' . $takeBack . ' ' . strtoupper($meta['symbol']) . ': the user only holds '
                . $currentAmount . ' ' . strtoupper($meta['symbol']) . ' now.',
                409
            );
        }

        if ($currentAmount - $takeBack > 1e-9) {
            $pdo->prepare('UPDATE holdings SET amount = ? WHERE id = ?')->execute([$currentAmount - $takeBack, $holding['id']]);
        } else {
            $pdo->prepare('DELETE FROM holdings WHERE id = ?')->execute([$holding['id']]);
        }
        log_trade($userId, 'remove', $meta['coinId'], $meta['symbol'], $meta['name'], $takeBack, 1.0);
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
