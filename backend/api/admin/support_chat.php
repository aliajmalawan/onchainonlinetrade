<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

$method = $_SERVER['REQUEST_METHOD'];

// GET ?userId=123 -> full thread with one user
if ($method === 'GET') {
    $userId = (int) ($_GET['userId'] ?? 0);
    if ($userId <= 0) json_err('userId is required.');

    // id as a tiebreaker: created_at is second-precision, so an auto-reply
    // inserted right after a user's first message can land in the same
    // second and would otherwise sort unpredictably.
    $stmt = db()->prepare('SELECT *, UNIX_TIMESTAMP(created_at) AS created_ts FROM support_messages WHERE user_id = ? ORDER BY created_at ASC, id ASC');
    $stmt->execute([$userId]);
    $messages = $stmt->fetchAll();

    // Opening a thread is what "reading" it means here — resets its unread
    // count on the conversation list.
    db()->prepare('INSERT INTO support_chat_reads (user_id, last_read_at) VALUES (?, NOW())
                    ON DUPLICATE KEY UPDATE last_read_at = NOW()')
        ->execute([$userId]);

    json_out(['messages' => array_map('public_message', $messages)]);
}

// POST -> reply to a user as support
if ($method === 'POST') {
    $isMultipart = str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data');
    $userId  = (int) ($isMultipart ? ($_POST['userId'] ?? 0) : (body()['userId'] ?? 0));
    $message = trim(($isMultipart ? ($_POST['message'] ?? '') : (body()['message'] ?? '')));

    if ($userId <= 0) json_err('userId is required.');

    [$attachmentPath, $attachmentName, $attachmentType] = $isMultipart ? handle_chat_attachment() : [null, null, null];
    if ($message === '' && !$attachmentPath) json_err('Message cannot be empty.');

    $stmt = db()->prepare('SELECT id FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    if (!$stmt->fetch()) json_err('User not found.', 404);

    db()->prepare('INSERT INTO support_messages (user_id, sender, message, attachment_path, attachment_name, attachment_type) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$userId, 'admin', $message, $attachmentPath, $attachmentName, $attachmentType]);

    $row = db()->query('SELECT *, UNIX_TIMESTAMP(created_at) AS created_ts FROM support_messages WHERE id = ' . (int) db()->lastInsertId())->fetch();
    json_out(['message' => public_message($row)], 201);
}

json_err('Method not allowed', 405);
