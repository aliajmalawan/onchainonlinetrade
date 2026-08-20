<?php
require_once __DIR__ . '/../helpers.php';
cors();

require_auth();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_err('Method not allowed', 405);

$stmt = db()->query('SELECT * FROM deposit_addresses ORDER BY currency, network');
json_out(['addresses' => array_map('public_deposit_address', $stmt->fetchAll())]);
