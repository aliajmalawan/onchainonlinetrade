<?php
require_once __DIR__ . '/../../helpers.php';
cors();
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Method not allowed', 405);

$b = body();
$currency = strtoupper(trim($b['currency'] ?? ''));
$network  = strtoupper(trim($b['network'] ?? ''));
$address  = trim($b['address'] ?? '');

if ($currency === '' || $network === '' || $address === '') {
    json_err('Currency, network and address are required.', 400);
}

try {
    db()->prepare('INSERT INTO deposit_addresses (currency, network, address) VALUES (?, ?, ?)')
        ->execute([$currency, $network, $address]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        json_err("An address for $currency on $network already exists — edit it instead.", 409);
    }
    json_err('Failed to add deposit address.', 500);
}

$id = (int) db()->lastInsertId();
$row = db()->prepare('SELECT * FROM deposit_addresses WHERE id = ?');
$row->execute([$id]);
json_out(['address' => public_deposit_address($row->fetch())], 201);
