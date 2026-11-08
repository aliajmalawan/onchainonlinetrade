<?php
require_once __DIR__ . '/../helpers.php';
cors();

require_auth();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_err('Method not allowed', 405);

// GET -> the trade timer options and the profit % each one earns.
json_out(['timers' => public_trade_profits()]);
