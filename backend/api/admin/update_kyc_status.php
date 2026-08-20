<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b = body();
$userId = isset($b['userId']) ? (int) $b['userId'] : null;
$kycStatus = isset($b['kycStatus']) ? $b['kycStatus'] : null;

if (!$userId || !in_array($kycStatus, ['verify', 'unverify', 'rejected'], true)) {
    json_err('Invalid parameters', 400);
}

$roleRow = db()->prepare('SELECT role FROM users WHERE id = ?');
$roleRow->execute([$userId]);
$target = $roleRow->fetch();
if ($target && $target['role'] === 'admin') {
    json_err('Cannot change KYC status for an admin account', 400);
}

// Update the user's KYC status
$stmt = db()->prepare("UPDATE users SET kyc_status = ? WHERE id = ?");
$stmt->execute([$kycStatus, $userId]);

// Also update the latest KYC document status to reflect the admin's action
try {
    if ($kycStatus === 'verify') {
        // Mark the most recent KYC submission as approved
        $row = db()->prepare('SELECT id FROM kyc_documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
        $row->execute([$userId]);
        $r = $row->fetch();
        if ($r) {
            db()->prepare('UPDATE kyc_documents SET status = ? WHERE id = ?')->execute(['approved', $r['id']]);
        }
    } elseif ($kycStatus === 'unverify') {
        // Set the most recent KYC submission back to pending
        $row = db()->prepare('SELECT id FROM kyc_documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
        $row->execute([$userId]);
        $r = $row->fetch();
        if ($r) {
            db()->prepare('UPDATE kyc_documents SET status = ? WHERE id = ?')->execute(['pending', $r['id']]);
        }
    } elseif ($kycStatus === 'rejected') {
        // Mark the most recent KYC submission as rejected
        $row = db()->prepare('SELECT id FROM kyc_documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
        $row->execute([$userId]);
        $r = $row->fetch();
        if ($r) {
            db()->prepare('UPDATE kyc_documents SET status = ? WHERE id = ?')->execute(['rejected', $r['id']]);
        }
        // Insert a notification for the user
        try {
            db()->prepare('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)')
                ->execute([$userId, 'kyc', 'Your identity verification has been rejected. Please resubmit documents or contact support.']);
        } catch (Exception $e) {
            // Ignore notification failure
        }
    }
} catch (Exception $e) {
    // Don't fail the whole request if KYC document update isn't applicable
}

json_out(['ok' => true]);
