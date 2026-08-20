<?php
require_once __DIR__ . '/../../helpers.php';
cors();
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
if ($id <= 0) json_err('id is required.', 400);

$stmt = db()->prepare('SELECT * FROM deposit_addresses WHERE id = ?');
$stmt->execute([$id]);
$row = $stmt->fetch();
if (!$row) json_err('Deposit address not found.', 404);

if (empty($_FILES['qr']) || !is_uploaded_file($_FILES['qr']['tmp_name'])) {
    json_err('A QR image file is required.', 400);
}

$uploadDir = __DIR__ . '/../../uploads/deposit_qr';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

$ext = strtolower(pathinfo($_FILES['qr']['name'], PATHINFO_EXTENSION));
if (!in_array($ext, ['png', 'jpg', 'jpeg', 'webp', 'gif'], true)) {
    json_err('Unsupported image type.', 400);
}

$fname = sprintf('qr_%d_%d.%s', $id, time(), $ext);
$dest = $uploadDir . '/' . $fname;
if (!move_uploaded_file($_FILES['qr']['tmp_name'], $dest)) {
    json_err('Failed to save QR image.', 500);
}

// Remove the old QR file, if any, now that it's been replaced.
if (!empty($row['qr_image'])) {
    $oldPath = __DIR__ . '/../../' . $row['qr_image'];
    if (is_file($oldPath)) @unlink($oldPath);
}

$relativePath = 'uploads/deposit_qr/' . $fname;
db()->prepare('UPDATE deposit_addresses SET qr_image = ? WHERE id = ?')->execute([$relativePath, $id]);

$stmt = db()->prepare('SELECT * FROM deposit_addresses WHERE id = ?');
$stmt->execute([$id]);
json_out(['address' => public_deposit_address($stmt->fetch())]);
