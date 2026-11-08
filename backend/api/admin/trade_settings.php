<?php
require_once __DIR__ . '/../../helpers.php';
cors();
require_admin();

$method = $_SERVER['REQUEST_METHOD'];

// GET -> every trade timer with its profit %.
if ($method === 'GET') {
    json_out(['timers' => public_trade_profits()]);
}

// POST {timers: [{duration, percent}]} -> update the profit % of existing
// timers (percent as a whole number, 15 for 15%). All-or-nothing: one bad
// value rejects the whole save.
if ($method === 'POST') {
    $timers = body()['timers'] ?? null;
    if (!is_array($timers) || !$timers) json_err('timers is required.');

    $known   = trade_profits();
    $updates = [];
    foreach ($timers as $t) {
        $duration = isset($t['duration']) ? (int) $t['duration'] : 0;
        $percent  = $t['percent'] ?? null;
        if (!array_key_exists($duration, $known)) json_err("Unknown timer: {$duration}s.");
        if (!is_numeric($percent) || floor((float) $percent) != (float) $percent || $percent < 0 || $percent > 100) {
            json_err("Profit for the {$duration}s timer must be a whole number from 0 to 100%.");
        }
        $updates[$duration] = (int) $percent / 100;
    }

    $pdo  = db();
    $stmt = $pdo->prepare('UPDATE trade_profit_settings SET profit_pct = ? WHERE duration = ?');
    $pdo->beginTransaction();
    foreach ($updates as $duration => $pct) {
        $stmt->execute([$pct, $duration]);
    }
    $pdo->commit();

    json_out(['timers' => public_trade_profits()]);
}

json_err('Method not allowed', 405);
