<?php
require_once __DIR__ . '/../../helpers.php';
cors();
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_err('Method not allowed', 405);

// Only genuine timed trades (Buy Long / Sell Short) carry a direction and a
// settled result — plain holding operations (e.g. a deposit credit, which
// also runs through add_or_merge_holding and so also lands in this table)
// have both columns null and are excluded here.
$stmt = db()->prepare(
    'SELECT t.*, u.name AS user_name, u.email AS user_email
     FROM trade_history t
     JOIN users u ON u.id = t.user_id
     WHERE t.direction IS NOT NULL AND t.result IS NOT NULL
     ORDER BY t.created_at DESC
     LIMIT 100'
);
$stmt->execute();
$trades = $stmt->fetchAll();

json_out([
    'trades' => array_map(function (array $t) {
        $row = public_trade($t);
        $row['userId'] = (int) $t['user_id'];
        $row['userName'] = $t['user_name'];
        $row['userEmail'] = $t['user_email'];
        return $row;
    }, $trades),
]);
