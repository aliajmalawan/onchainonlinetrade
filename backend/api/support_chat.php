<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u      = require_auth();
$method = $_SERVER['REQUEST_METHOD'];

// GET -> this user's own conversation with support
if ($method === 'GET') {
    $stmt = db()->prepare('SELECT * FROM support_messages WHERE user_id = ? ORDER BY created_at ASC');
    $stmt->execute([$u['id']]);
    json_out(['messages' => array_map('public_message', $stmt->fetchAll())]);
}

// POST -> send a message to support
if ($method === 'POST') {
    $b       = body();
    $message = trim($b['message'] ?? '');
    if ($message === '') json_err('Message cannot be empty.');

    db()->prepare('INSERT INTO support_messages (user_id, sender, message) VALUES (?, ?, ?)')
        ->execute([$u['id'], 'user', $message]);

    $row = db()->query('SELECT * FROM support_messages WHERE id = ' . (int) db()->lastInsertId())->fetch();
    json_out(['message' => public_message($row)], 201);
}

json_err('Method not allowed', 405);
