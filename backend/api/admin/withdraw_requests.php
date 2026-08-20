<?php
require_once __DIR__ . '/../../helpers.php';
cors();
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_err('Method not allowed', 405);

$stmt = db()->prepare(
    'SELECT w.*, u.name AS user_name, u.email AS user_email
     FROM withdraw_history w
     JOIN users u ON u.id = w.user_id
     ORDER BY w.created_at DESC
     LIMIT 500'
);
$stmt->execute();
$withdraws = $stmt->fetchAll();

json_out([
    'withdraws' => array_map(function (array $w) {
        return [
            'id'        => (int) $w['id'],
            'userId'    => (int) $w['user_id'],
            'userName'  => $w['user_name'],
            'userEmail' => $w['user_email'],
            'amount'    => (float) $w['amount'],
            'currency'  => $w['currency'],
            'network'   => $w['network'] ?? null,
            'address'   => $w['address'] ?? null,
            'fee'       => isset($w['fee']) ? (float) $w['fee'] : null,
            'txId'      => $w['tx_id'] ?? null,
            'status'    => $w['status'],
            'createdAt' => $w['created_at'],
        ];
    }, $withdraws),
]);
