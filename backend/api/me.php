<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u = require_auth();
json_out(['user' => public_user($u)]);