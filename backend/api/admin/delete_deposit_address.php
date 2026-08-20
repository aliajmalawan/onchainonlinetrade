<?php
require_once __DIR__ . '/../../helpers.php';
cors();
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b  = body();
$id = (int) ($b['id'] ?? 0);

if ($id <= 0) json_err('id is required.', 400);

db()->prepare('DELETE FROM deposit_addresses WHERE id = ?')->execute([$id]);
json_out(['ok' => true]);
