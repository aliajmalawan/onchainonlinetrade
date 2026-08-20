<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u = require_auth();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b     = body();
$name  = trim($b['name'] ?? '');
$email = trim($b['email'] ?? '');
$phone = trim($b['phone'] ?? '');

if ($name === '' || $email === '' || $phone === '') json_err('Name, email and phone number are required.');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_err('Please enter a valid email.');

try {
    db()->prepare('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?')
        ->execute([$name, $email, $phone, $u['id']]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') json_err('An account with this email already exists.', 409);
    json_err('Could not update account.', 500);
}

$row = db()->query('SELECT * FROM users WHERE id = ' . (int) $u['id'])->fetch();
json_out(['user' => public_user($row)]);
