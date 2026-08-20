<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

$pdo = db();
try {
    $rows = $pdo->query(
        'SELECT u.*, (
             SELECT k.status
             FROM kyc_documents k
             WHERE k.user_id = u.id
             ORDER BY k.created_at DESC
             LIMIT 1
         ) AS latest_kyc_document_status,
         (
             SELECT COUNT(*)
             FROM holdings h
             WHERE h.user_id = u.id
         ) AS holdings_count
         FROM users u
         ORDER BY u.created_at DESC'
    )->fetchAll();
} catch (PDOException $e) {
    // If the KYC table is missing or the query fails, still return users.
    $rows = $pdo->query('SELECT * FROM users ORDER BY created_at DESC')->fetchAll();
}
json_out(['users' => array_map('public_user', $rows)]);