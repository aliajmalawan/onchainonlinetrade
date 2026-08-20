<?php
require_once __DIR__ . '/../../helpers.php';
cors();
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b        = body();
$userId   = (int) ($b['userId'] ?? 0);
$profitMode = isset($b['profitMode']) ? (int) ($b['profitMode'] ? 1 : 0) : null;
$lossMode   = isset($b['lossMode']) ? (int) ($b['lossMode'] ? 1 : 0) : null;

if ($userId <= 0) json_err('userId is required.');
if ($profitMode === null && $lossMode === null) json_err('At least one mode value is required.');

$stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();
if (!$user) json_err('User not found.', 404);
if ($user['role'] === 'admin') json_err('Cannot change trade mode for admin users.', 403);

$fields = [];
$params = [];
if ($profitMode !== null) {
    $fields[] = 'profit_mode = ?';
    $params[] = $profitMode;
}
if ($lossMode !== null) {
    $fields[] = 'loss_mode = ?';
    $params[] = $lossMode;
}
$params[] = $userId;

$stmt = db()->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?');
$stmt->execute($params);

$stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();
json_out(['user' => public_user($user)]);
