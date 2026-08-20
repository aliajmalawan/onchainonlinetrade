<?php
require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b        = body();
$name     = trim($b['name'] ?? '');
$email    = trim($b['email'] ?? '');
$phone    = trim($b['phone'] ?? '');
$password = (string) ($b['password'] ?? '');

if ($name === '' || $email === '' || $phone === '' || strlen($password) < 8) {
    json_err('Name, email, phone number and a 8+ character password are required.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_err('Please enter a valid email.');
}

try {
    db()->prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
        ->execute([$name, $email, $phone, password_hash($password, PASSWORD_DEFAULT), 'user']);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') json_err('An account with this email already exists.', 409);
    json_err('Could not create account.', 500);
}

$id   = (int) db()->lastInsertId();
$user = db()->query('SELECT * FROM users WHERE id = ' . $id)->fetch();
json_out(['token' => issue_token($id), 'user' => public_user($user)], 201);