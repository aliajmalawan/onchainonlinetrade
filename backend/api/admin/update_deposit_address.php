<?php
require_once __DIR__ . '/../../helpers.php';
cors();
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b = body();
$id      = isset($b['id']) ? (int) $b['id'] : 0;
$address = trim($b['address'] ?? '');

if ($id <= 0 || $address === '') json_err('id and a non-empty address are required.', 400);

$stmt = db()->prepare('SELECT id FROM deposit_addresses WHERE id = ?');
$stmt->execute([$id]);
if (!$stmt->fetch()) json_err('Deposit address not found.', 404);

db()->prepare('UPDATE deposit_addresses SET address = ? WHERE id = ?')->execute([$address, $id]);

$row = db()->prepare('SELECT * FROM deposit_addresses WHERE id = ?');
$row->execute([$id]);
json_out(['address' => public_deposit_address($row->fetch())]);
