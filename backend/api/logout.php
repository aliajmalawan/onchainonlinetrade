<?php
require_once __DIR__ . '/../helpers.php';
cors();

$token = bearer_token();
if ($token) {
    db()->prepare('DELETE FROM tokens WHERE token = ?')->execute([$token]);
}
json_out(['ok' => true]);