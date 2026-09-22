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

// The requested amount is deducted from the user's holding the moment they
// submit the request (withdraw_request.php), to reserve it while it's
// pending — "completed" doesn't need to touch the balance again, the funds
// are already gone. But rejecting one must hand that reservation back,
// otherwise the user permanently loses funds for a withdrawal that never
// went out. Only refund on the transition into "failed" (never on a later
// re-save), so re-selecting "failed" can't double-credit.
$newlyFailed = $status === 'failed' && $withdraw['status'] !== 'failed';

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

try {
    $pdo = db();
    $pdo->beginTransaction();

    $pdo->prepare('UPDATE withdraw_history SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);

    if ($newlyFailed) {
        $symbol = strtoupper($withdraw['currency']);
        $stmt = $pdo->prepare('SELECT * FROM holdings WHERE user_id = ? AND symbol = ?');
        $stmt->execute([(int) $withdraw['user_id'], $symbol]);
        $existing = $stmt->fetch();

        if ($existing) {
            // Exact reversal of the original deduction — no buy_price
            // change, so this can't skew the holding's cost basis.
            $pdo->prepare('UPDATE holdings SET amount = amount + ? WHERE id = ?')
                ->execute([(float) $withdraw['amount'], $existing['id']]);
        } else {
            // The holding was fully drained by this withdrawal, so it has
            // to be recreated from scratch — there's no stored cost basis
            // to restore, so it falls back to the same buy_price=1.0
            // assumption already used elsewhere in this codebase for
            // exactly this gap (accurate for stablecoins; a non-stablecoin
            // refund here would need a real price source to be precise).
            $meta = deposit_coin_meta($withdraw['currency']);
            add_or_merge_holding(
                (int) $withdraw['user_id'], $meta['coinId'], $meta['symbol'], $meta['name'], $meta['image'],
                (float) $withdraw['amount'], 1.0
            );
        }
    }

    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    json_err('Failed to update withdrawal request.', 500);
}

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
