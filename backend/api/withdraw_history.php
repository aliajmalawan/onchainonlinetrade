<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u = require_auth();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_err('Method not allowed', 405);

$stmt = db()->prepare('SELECT * FROM withdraw_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 200');
$stmt->execute([$u['id']]);
json_out(['withdraws' => array_map('public_withdraw', $stmt->fetchAll())]);
