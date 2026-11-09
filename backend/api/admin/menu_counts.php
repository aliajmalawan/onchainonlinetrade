<?php
require_once __DIR__ . '/../../helpers.php';
cors();
$admin = require_admin();

// Admin menu badges count only what arrived since this admin last opened the
// matching page, so opening Deposit Requests / Withdrawals / Live Chat clears
// its badge. Created on first use so an existing install needs no migration.
const MENU_SECTIONS = ['deposits', 'withdrawals', 'chat'];

db()->exec("CREATE TABLE IF NOT EXISTS admin_menu_seen (
    admin_id INT NOT NULL,
    section  VARCHAR(20) NOT NULL,
    seen_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (admin_id, section),
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

$method = $_SERVER['REQUEST_METHOD'];

// POST {section} -> this admin has just opened that page.
if ($method === 'POST') {
    $section = body()['section'] ?? '';
    if (!in_array($section, MENU_SECTIONS, true)) json_err('Unknown section.');
    db()->prepare(
        'INSERT INTO admin_menu_seen (admin_id, section, seen_at) VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE seen_at = NOW()'
    )->execute([$admin['id'], $section]);
    json_out(['ok' => true]);
}

if ($method !== 'GET') json_err('Method not allowed', 405);

// GET -> counts for the admin menu badges:
//   pendingDeposits:    pending deposit requests that came in since the
//                       admin last opened Deposit Requests
//   pendingWithdrawals: the same for Withdrawals
//   chatUsers:          customers with support messages no admin has read
//                       in their thread (same rule as support_chats.php),
//                       counting only messages since the admin last opened
//                       Live Chat
$stmt = db()->prepare('SELECT section, seen_at FROM admin_menu_seen WHERE admin_id = ?');
$stmt->execute([$admin['id']]);
$seen = [];
foreach ($stmt->fetchAll() as $r) $seen[$r['section']] = $r['seen_at'];
$since = fn(string $section) => $seen[$section] ?? '1970-01-01 00:00:00';

$stmt = db()->prepare("SELECT COUNT(*) FROM deposit_requests WHERE status = 'pending' AND created_at > ?");
$stmt->execute([$since('deposits')]);
$pendingDeposits = (int) $stmt->fetchColumn();

$stmt = db()->prepare("SELECT COUNT(*) FROM withdraw_history WHERE status = 'pending' AND created_at > ?");
$stmt->execute([$since('withdrawals')]);
$pendingWithdrawals = (int) $stmt->fetchColumn();

$stmt = db()->prepare("
    SELECT COUNT(DISTINCT sm.user_id)
    FROM support_messages sm
    LEFT JOIN support_chat_reads r ON r.user_id = sm.user_id
    WHERE sm.sender = 'user'
      AND sm.created_at > COALESCE(r.last_read_at, '1970-01-01 00:00:00')
      AND sm.created_at > ?
");
$stmt->execute([$since('chat')]);
$chatUsers = (int) $stmt->fetchColumn();

json_out([
    'chatUsers'          => $chatUsers,
    'pendingDeposits'    => $pendingDeposits,
    'pendingWithdrawals' => $pendingWithdrawals,
]);
