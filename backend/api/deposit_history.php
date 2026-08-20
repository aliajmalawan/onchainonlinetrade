<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u = require_auth();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_err('Method not allowed', 405);

$stmt = db()->prepare('SELECT * FROM deposit_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 200');
$stmt->execute([$u['id']]);
json_out(['deposits' => array_map('public_deposit', $stmt->fetchAll())]);
