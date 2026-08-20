<?php
require_once __DIR__ . '/../../helpers.php';
cors();

$me = require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b      = body();
$userId = (int) ($b['userId'] ?? 0);

if ($userId === (int) $me['id']) json_err("You can't delete your own account.", 400);

// holdings + tokens are removed automatically via ON DELETE CASCADE.
db()->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);
json_out(['ok' => true]);