<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u = require_auth();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

// Ensure upload directory exists
$uploadDir = __DIR__ . '/../uploads/kyc';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

$idType = $_POST['idType'] ?? null;
if (!in_array($idType, ['passport','national_id','driving_license'], true)) json_err('Invalid id type', 400);

$saved = ['front' => null, 'back' => null, 'selfie' => null];
$map = ['front' => 'front', 'back' => 'back', 'selfie' => 'selfie'];
foreach ($map as $field => $col) {
    if (!empty($_FILES[$field]) && is_uploaded_file($_FILES[$field]['tmp_name'])) {
        $ext = pathinfo($_FILES[$field]['name'], PATHINFO_EXTENSION);
        $fname = sprintf('%s_%d_%s.%s', $field, $u['id'], time(), $ext);
        $dest = $uploadDir . '/' . $fname;
        if (move_uploaded_file($_FILES[$field]['tmp_name'], $dest)) {
            // store path relative to backend root
            $saved[$field] = 'uploads/kyc/' . $fname;
        }
    }
}

// Insert a new KYC record
$stmt = db()->prepare(
    'INSERT INTO kyc_documents (user_id, id_type, front_path, back_path, selfie_path, status)
     VALUES (?, ?, ?, ?, ?, ?)'
);
$stmt->execute([$u['id'], $idType, $saved['front'], $saved['back'], $saved['selfie'], 'pending']);

json_out(['ok' => true]);
