<?php
require_once __DIR__ . '/../../helpers.php';
cors();
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_err('Method not allowed', 405);

$stmt = db()->prepare(
    'SELECT d.*, u.name AS user_name, u.email AS user_email
     FROM deposit_requests d
     JOIN users u ON u.id = d.user_id
     ORDER BY d.created_at DESC
     LIMIT 500'
);
$stmt->execute();
$deposits = $stmt->fetchAll();

json_out([
    'deposits' => array_map(function (array $d) {
        return [
            'id'        => (int) $d['id'],
            'userId'    => (int) $d['user_id'],
            'userName'  => $d['user_name'],
            'userEmail' => $d['user_email'],
            'amount'    => (float) $d['amount'],
            'currency'  => $d['currency'],
            'network'   => $d['network'] ?? null,
            'address'   => $d['address'] ?? null,
            'txId'      => $d['tx_id'] ?? null,
            'txProofImage' => $d['tx_proof_image'] ?? null,
            'status'    => $d['status'],
            'createdAt' => $d['created_at'],
        ];
    }, $deposits),
]);
