<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u = require_auth();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

// Submitted as multipart/form-data because a transaction screenshot is required.
$currency = strtoupper(trim($_POST['currency'] ?? ''));
$network  = strtoupper(trim($_POST['network'] ?? ''));
// The user no longer states an amount or reference up front — an admin
// sets the real amount (from the screenshot) when reviewing the request,
// via admin/update_deposit_status.php.
$amount   = 0;
$txId     = trim($_POST['txId'] ?? '');

if ($currency === '' || $network === '') {
    json_err('Currency and network are required.', 400);
}
if (empty($_FILES['proof']) || !is_uploaded_file($_FILES['proof']['tmp_name'])) {
    json_err('A screenshot of the transaction is required.', 400);
}
$ext = strtolower(pathinfo($_FILES['proof']['name'], PATHINFO_EXTENSION));
if (!in_array($ext, ['png', 'jpg', 'jpeg', 'webp', 'gif'], true)) {
    json_err('Unsupported image type for the transaction screenshot.', 400);
}

// The deposit address always comes from what an admin has configured —
// never trust a client-submitted address for the platform's own wallet.
$stmt = db()->prepare('SELECT * FROM deposit_addresses WHERE currency = ? AND network = ?');
$stmt->execute([$currency, $network]);
$depositAddress = $stmt->fetch();
if (!$depositAddress) {
    json_err('No deposit address is configured for that currency/network yet.', 400);
}

$uploadDir = __DIR__ . '/../uploads/deposit_proof';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
$fname = sprintf('proof_%d_%d.%s', $u['id'], time(), $ext);
$dest = $uploadDir . '/' . $fname;
if (!move_uploaded_file($_FILES['proof']['tmp_name'], $dest)) {
    json_err('Failed to save the transaction screenshot.', 500);
}
$proofPath = 'uploads/deposit_proof/' . $fname;

// Nothing is credited yet — that happens only once an admin marks the
// request completed (see admin/update_deposit_status.php).
$id = log_deposit($u['id'], $amount, $currency, $network, $depositAddress['address'], $txId, 'pending', $proofPath);

$stmt = db()->prepare('SELECT * FROM deposit_requests WHERE id = ?');
$stmt->execute([$id]);
json_out(['deposit' => public_deposit($stmt->fetch())], 201);
