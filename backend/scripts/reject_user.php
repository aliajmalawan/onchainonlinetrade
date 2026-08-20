<?php
// Usage: php reject_user.php email@example.com
require_once __DIR__ . '/../config.php';

try {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (PDOException $e) {
    fwrite(STDERR, "[error] DB connect failed: " . $e->getMessage() . "\n");
    exit(1);
}

$email = $argv[1] ?? null;
if (!$email) {
    fwrite(STDERR, "Usage: php reject_user.php email@example.com\n");
    exit(2);
}

$stmt = $pdo->prepare('SELECT id, name FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$u = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$u) {
    fwrite(STDERR, "[error] No user found with email: $email\n");
    exit(3);
}

$userId = (int) $u['id'];
try {
    $pdo->beginTransaction();
    $pdo->prepare("UPDATE users SET status = 'rejected' WHERE id = ?")->execute([$userId]);
    // mark latest kyc document rejected if exists
    $row = $pdo->prepare('SELECT id FROM kyc_documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
    $row->execute([$userId]);
    $r = $row->fetch(PDO::FETCH_ASSOC);
    if ($r) {
        $pdo->prepare("UPDATE kyc_documents SET status = 'rejected' WHERE id = ?")->execute([(int)$r['id']]);
    }
    $pdo->commit();
    fwrite(STDOUT, "[ok] Marked user {$u['name']} ({$email}) as rejected.\n");
    exit(0);
} catch (Exception $e) {
    $pdo->rollBack();
    fwrite(STDERR, "[error] " . $e->getMessage() . "\n");
    exit(4);
}
