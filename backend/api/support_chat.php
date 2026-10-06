<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u      = require_auth();
$method = $_SERVER['REQUEST_METHOD'];

// GET -> this user's own conversation with support
if ($method === 'GET') {
    // id as a tiebreaker: created_at is second-precision, so the auto-reply
    // (inserted right after a first message, in the same request) can land
    // in the very same second and would otherwise sort unpredictably.
    $stmt = db()->prepare('SELECT *, UNIX_TIMESTAMP(created_at) AS created_ts FROM support_messages WHERE user_id = ? ORDER BY created_at ASC, id ASC');
    $stmt->execute([$u['id']]);
    json_out(['messages' => array_map('public_message', $stmt->fetchAll())]);
}

// POST -> send a message to support
if ($method === 'POST') {
    // Plain text comes in as JSON; a message with an attachment comes in as
    // multipart/form-data (so $_FILES is populated), with the text caption
    // in $_POST instead of the JSON body.
    $isMultipart = str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data');
    $message = trim(($isMultipart ? ($_POST['message'] ?? '') : (body()['message'] ?? '')));

    [$attachmentPath, $attachmentName, $attachmentType] = $isMultipart ? handle_chat_attachment() : [null, null, null];
    if ($message === '' && !$attachmentPath) json_err('Message cannot be empty.');

    // Check BEFORE inserting — this tells us whether the message we're
    // about to save is this user's very first one.
    $countStmt = db()->prepare('SELECT COUNT(*) FROM support_messages WHERE user_id = ?');
    $countStmt->execute([$u['id']]);
    $isFirstMessage = ((int) $countStmt->fetchColumn()) === 0;

    db()->prepare('INSERT INTO support_messages (user_id, sender, message, attachment_path, attachment_name, attachment_type) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$u['id'], 'user', $message, $attachmentPath, $attachmentName, $attachmentType]);
    $userMessageId = (int) db()->lastInsertId();

    if ($isFirstMessage) {
        $autoReply = "Hello! Thank you for reaching out to Onchain Support.\n\n"
            . "Could you please share your registered email address so we can look into this and assist you better?\n\n"
            . "Our team is here to help with any questions or concerns you may have, and we will get back to you within 24 hours.";
        db()->prepare('INSERT INTO support_messages (user_id, sender, message) VALUES (?, ?, ?)')
            ->execute([$u['id'], 'admin', $autoReply]);
    }

    // Return the user's own message (what the caller just sent), not
    // whichever row ended up with the highest id.
    $row = db()->query('SELECT *, UNIX_TIMESTAMP(created_at) AS created_ts FROM support_messages WHERE id = ' . $userMessageId)->fetch();
    json_out(['message' => public_message($row)], 201);
}

json_err('Method not allowed', 405);
