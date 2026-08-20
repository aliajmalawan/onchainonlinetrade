<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_err('Method not allowed', 405);

$userId = isset($_GET['userId']) ? (int) $_GET['userId'] : null;
if (!$userId) json_err('Missing userId', 400);

$stmt = db()->prepare('SELECT * FROM kyc_documents WHERE user_id = ? ORDER BY created_at DESC');
$stmt->execute([$userId]);
json_out(['kyc' => array_map('public_kyc', $stmt->fetchAll())]);
