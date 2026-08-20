<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b      = body();
$userId = (int) ($b['userId'] ?? 0);
if ($userId <= 0) json_err('userId is required.');

$stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();
if (!$user) json_err('User not found.', 404);

// Issues a fresh session token for the target user. The admin never sees
// or needs the user's password — this is a support-style "login as" swap.
json_out(['token' => issue_token($userId), 'user' => public_user($user)]);
