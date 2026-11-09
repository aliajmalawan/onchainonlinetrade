<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u = require_auth();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_err('Method not allowed', 405);

// GET -> how many support replies this customer hasn't seen yet (for the
// Customer Support menu badge). Opening the chat marks them seen — see
// support_chat.php (?seen=1).
ensure_message_seen_column();
$stmt = db()->prepare("SELECT COUNT(*) FROM support_messages WHERE user_id = ? AND sender = 'admin' AND seen_at IS NULL");
$stmt->execute([$u['id']]);

json_out(['messages' => (int) $stmt->fetchColumn()]);
