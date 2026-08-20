<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

$method = $_SERVER['REQUEST_METHOD'];

// GET ?userId=123 -> full thread with one user
if ($method === 'GET') {
    $userId = (int) ($_GET['userId'] ?? 0);
    if ($userId <= 0) json_err('userId is required.');

    $stmt = db()->prepare('SELECT * FROM support_messages WHERE user_id = ? ORDER BY created_at ASC');
    $stmt->execute([$userId]);
    json_out(['messages' => array_map('public_message', $stmt->fetchAll())]);
}

// POST -> reply to a user as support
if ($method === 'POST') {
    $b       = body();
    $userId  = (int) ($b['userId'] ?? 0);
    $message = trim($b['message'] ?? '');

    if ($userId <= 0) json_err('userId is required.');
    if ($message === '') json_err('Message cannot be empty.');

    $stmt = db()->prepare('SELECT id FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    if (!$stmt->fetch()) json_err('User not found.', 404);

    db()->prepare('INSERT INTO support_messages (user_id, sender, message) VALUES (?, ?, ?)')
        ->execute([$userId, 'admin', $message]);

    $row = db()->query('SELECT * FROM support_messages WHERE id = ' . (int) db()->lastInsertId())->fetch();
    json_out(['message' => public_message($row)], 201);
}

json_err('Method not allowed', 405);
