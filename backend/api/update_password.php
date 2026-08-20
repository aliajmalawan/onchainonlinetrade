<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u = require_auth();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b       = body();
$current = (string) ($b['currentPassword'] ?? '');
$next    = (string) ($b['newPassword'] ?? '');

if (!password_verify($current, $u['password_hash'])) {
    json_err('Current password is incorrect.', 401);
}
if (strlen($next) < 8 || strlen($next) > 20) {
    json_err('New password must be between 8 and 20 characters.');
}

db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    ->execute([password_hash($next, PASSWORD_DEFAULT), $u['id']]);

json_out(['ok' => true]);
