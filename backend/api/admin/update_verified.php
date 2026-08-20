<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b = body();
$userId = isset($b['userId']) ? (int) $b['userId'] : null;
$verified = isset($b['verified']) ? (int) $b['verified'] : null;

if (!$userId || !in_array($verified, [0,1], true)) json_err('Invalid parameters', 400);

// Map old numeric values to new ENUM values
$kycStatus = $verified === 1 ? 'verify' : 'unverify';

$stmt = db()->prepare("UPDATE users SET status = 'active', kyc_status = ? WHERE id = ?");
$stmt->execute([$kycStatus, $userId]);

// Also update the latest KYC document status for this user so admins see documents reflect verification.
try {
	if ($verified === 1) {
		// mark the most recent KYC submission as approved
		$row = db()->prepare('SELECT id FROM kyc_documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
		$row->execute([$userId]);
		$r = $row->fetch();
		if ($r) {
			db()->prepare('UPDATE kyc_documents SET status = ? WHERE id = ?')->execute(['approved', $r['id']]);
		}
	} else {
		// when unverified, set the most recent KYC submission back to pending
		$row = db()->prepare('SELECT id FROM kyc_documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
		$row->execute([$userId]);
		$r = $row->fetch();
		if ($r) {
			db()->prepare('UPDATE kyc_documents SET status = ? WHERE id = ?')->execute(['pending', $r['id']]);
		}
	}
} catch (Exception $e) {
	// don't fail the whole request if KYC update isn't applicable
}

json_out(['ok' => true]);
