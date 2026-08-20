<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b        = body();
$userId   = (int) ($b['userId'] ?? 0);
$coinId   = trim($b['coinId'] ?? '');
$symbol   = trim($b['symbol'] ?? '');
$name     = trim($b['name'] ?? '');
$image    = $b['image'] ?? null;
$amount   = (float) ($b['amount'] ?? 0);
$buyPrice = (float) ($b['buyPrice'] ?? 0);

if ($userId <= 0 || $coinId === '' || $amount <= 0 || $buyPrice <= 0) {
    json_err('userId, coinId, a positive amount and a positive buyPrice are required.');
}

$stmt = db()->prepare('SELECT id FROM users WHERE id = ?');
$stmt->execute([$userId]);
if (!$stmt->fetch()) json_err('User not found.', 404);

$id  = add_or_merge_holding($userId, $coinId, $symbol, $name, $image, $amount, $buyPrice);
$row = db()->query('SELECT * FROM holdings WHERE id = ' . $id)->fetch();
json_out(['holding' => public_holding($row)], 201);
