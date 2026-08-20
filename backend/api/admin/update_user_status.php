<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b = body();
$userId = isset($b['userId']) ? (int) $b['userId'] : null;
$status = isset($b['status']) ? $b['status'] : null;

if (!$userId || !in_array($status, ['active','rejected'], true)) json_err('Invalid parameters', 400);

if ($status === 'rejected') {
    $stmt = db()->prepare('UPDATE users SET status = ?, kyc_status = ? WHERE id = ?');
    $stmt->execute([$status, 'rejected', $userId]);
} else {
    $stmt = db()->prepare('UPDATE users SET status = ?, kyc_status = ? WHERE id = ?');
    $stmt->execute([$status, 'unverify', $userId]);
}

// Update latest KYC document status when rejecting so admin UI reflects it
try {
    if ($status === 'rejected') {
        $row = db()->prepare('SELECT id FROM kyc_documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
        $row->execute([$userId]);
        $r = $row->fetch();
        if ($r) {
            db()->prepare('UPDATE kyc_documents SET status = ? WHERE id = ?')->execute(['rejected', $r['id']]);
        }
        // insert a notification for the user
        try {
            db()->prepare('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)')
                ->execute([$userId, 'kyc', 'Your identity verification has been rejected. Please resubmit documents.']);
        } catch (Exception $e) {
            // ignore notification failure
        }
    }
} catch (Exception $e) {
    // ignore
}

json_out(['ok' => true]);
