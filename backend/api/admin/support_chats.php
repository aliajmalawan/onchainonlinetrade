<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_err('Method not allowed', 405);

// One row per user who has ever messaged support, with a preview of their
// latest message, most recently active first.
$rows = db()->query("
    SELECT u.id, u.name, u.email,
           m.message      AS last_message,
           m.sender        AS last_sender,
           m.created_at    AS last_at
    FROM users u
    JOIN support_messages m ON m.user_id = u.id
    JOIN (
        SELECT user_id, MAX(created_at) AS max_at
        FROM support_messages
        GROUP BY user_id
    ) latest ON latest.user_id = m.user_id AND latest.max_at = m.created_at
    ORDER BY m.created_at DESC
")->fetchAll();

json_out(['conversations' => array_map(function ($r) {
    return [
        'userId'      => (int) $r['id'],
        'name'        => $r['name'],
        'email'       => $r['email'],
        'lastMessage' => $r['last_message'],
        'lastSender'  => $r['last_sender'],
        'lastAt'      => $r['last_at'],
    ];
}, $rows)]);
