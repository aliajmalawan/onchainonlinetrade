<?php
require_once __DIR__ . '/../helpers.php';
cors();

require_auth();

$u = current_user();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Support chat messages are signalled by the Customer Support menu badge,
    // not the bell — older 'support_chat' rows are left out.
    $stmt = db()->prepare("SELECT *, UNIX_TIMESTAMP(created_at) AS created_ts FROM notifications WHERE user_id = ? AND type <> 'support_chat' ORDER BY created_at DESC LIMIT 100");
    $stmt->execute([$u['id']]);
    $rows = $stmt->fetchAll();
    json_out(['notifications' => array_map('public_notification', $rows)]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = body();
    if (!isset($b['id'])) json_err('Missing id', 400);
    $id = (int) $b['id'];
    db()->prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')->execute([$id, $u['id']]);
    json_out(['ok' => true]);
}

json_err('Method not allowed', 405);

function public_notification($n) {
    return [
        'id' => (int) $n['id'],
        'type' => $n['type'],
        'message' => $n['message'],
        'data' => isset($n['data']) ? json_decode($n['data'], true) : null,
        'isRead' => isset($n['is_read']) ? (bool) $n['is_read'] : false,
        // UTC ISO time, so every viewer's browser reads it correctly whatever
        // timezone the database server runs in.
        'createdAt' => gmdate('c', (int) $n['created_ts']),
    ];
}
