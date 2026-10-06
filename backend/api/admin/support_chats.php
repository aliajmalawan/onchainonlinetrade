<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_err('Method not allowed', 405);

// One row per user who has ever messaged support, with a preview of their
// latest message, most recently active first. Keyed on MAX(id) rather than
// MAX(created_at) — created_at is only second-precision, and a first
// message's auto-reply is inserted in the very same request (so often the
// very same second), which would otherwise make "the latest message" an
// ambiguous tie; id is unique and strictly insertion-ordered.
$rows = db()->query("
    SELECT u.id, u.name, u.email,
           m.message         AS last_message,
           m.attachment_type AS last_attachment_type,
           m.sender          AS last_sender,
           UNIX_TIMESTAMP(m.created_at) AS last_ts,
           (
             SELECT COUNT(*) FROM support_messages sm
             WHERE sm.user_id = u.id AND sm.sender = 'user'
               AND sm.created_at > COALESCE(r.last_read_at, '1970-01-01 00:00:00')
           ) AS unread_count,
           EXISTS(
             SELECT 1 FROM tokens t WHERE t.user_id = u.id AND t.expires_at > NOW()
           ) AS is_online
    FROM users u
    JOIN support_messages m ON m.user_id = u.id
    JOIN (
        SELECT user_id, MAX(id) AS max_id
        FROM support_messages
        GROUP BY user_id
    ) latest ON latest.user_id = m.user_id AND latest.max_id = m.id
    LEFT JOIN support_chat_reads r ON r.user_id = u.id
    ORDER BY m.created_at DESC, m.id DESC
")->fetchAll();

json_out(['conversations' => array_map(function ($r) {
    return [
        'userId'              => (int) $r['id'],
        'name'                => $r['name'],
        'email'               => $r['email'],
        'lastMessage'         => $r['last_message'],
        'lastAttachmentType'  => $r['last_attachment_type'],
        'lastSender'          => $r['last_sender'],
        'lastAt'              => gmdate('c', (int) $r['last_ts']),
        'unreadCount'         => (int) $r['unread_count'],
        'online'              => (bool) $r['is_online'],
    ];
}, $rows)]);
