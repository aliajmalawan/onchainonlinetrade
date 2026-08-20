<?php
require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b        = body();
$email    = trim($b['email'] ?? '');
$password = (string) ($b['password'] ?? '');

$stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    json_err('Incorrect email or password.', 401);
}

json_out(['token' => issue_token((int) $user['id']), 'user' => public_user($user)]);