<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_err('Method not allowed', 405);

$userId = (int) ($_GET['userId'] ?? 0);
if ($userId <= 0) json_err('userId is required.');

$stmt = db()->prepare('SELECT * FROM holdings WHERE user_id = ? ORDER BY created_at DESC');
$stmt->execute([$userId]);
json_out(['holdings' => array_map('public_holding', $stmt->fetchAll())]);
