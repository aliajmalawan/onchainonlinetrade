<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_err('Method not allowed', 405);

$userId = isset($_GET['userId']) ? (int) $_GET['userId'] : null;
if (!$userId) json_err('Missing userId', 400);

$stmt = db()->prepare(
    'SELECT ip_address, user_agent, location, created_at, expires_at
     FROM tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
);
$stmt->execute([$userId]);

json_out(['sessions' => array_map(function ($r) {
    return [
        'ip' => $r['ip_address'],
        'userAgent' => $r['user_agent'],
        'location' => $r['location'],
        'createdAt' => $r['created_at'],
        'active' => strtotime($r['expires_at']) > time(),
    ];
}, $stmt->fetchAll())]);
