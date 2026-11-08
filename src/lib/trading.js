import { apiAddHolding, apiRemoveHolding } from './backend'
import { num } from './format'

// Profit percentages by trade duration (seconds), as decimals (0.10 = 10%).
// These are only the defaults shown until the admin's Manage Profits
// settings load (setProfitTimers); the backend always settles with its own.
let PROFIT_PERCENTAGES = {
  30: 0.10,
  60: 0.15,
  180: 0.15,
  300: 0.25,
}

// timers: [{ duration, percent }] from the API (percent as 15 for 15%).
export function setProfitTimers(timers) {
  PROFIT_PERCENTAGES = Object.fromEntries(timers.map((t) => [t.duration, t.percent / 100]))
}

// Trade timer options in seconds, shortest first.
export function getTradeDurations() {
  return Object.keys(PROFIT_PERCENTAGES).map(Number).sort((a, b) => a - b)
}

export function getProfitPercentage(duration) {
  return PROFIT_PERCENTAGES[duration] ?? 0
}

// profit = amount * percentage. Returns only the profit amount — does not touch the wallet.
export function calculateProfit(amount, duration) {
  return amount * getProfitPercentage(duration)
}

// Returns the loss amount for a trade — the full staked amount. Does not touch the wallet.
export function calculateLoss(amount) {
  return amount
}

// Direction label shared by the timer, popup, and history messaging.
function directionLabelFor(trade) {
  return trade.side === 'buy' ? 'Buy Long' : 'Sell Short'
}

// The only place that actually calls the backend to settle a trade (credit
// or deduct the wallet). Buy vs sell branching lives here once instead of
// being duplicated at every call site.
export function updateWallet({ side, holdingId, coinId, symbol, name, image, amount, price, conditionPct, duration, openingPrice }) {
  if (side === 'buy') {
    return apiAddHolding({
      coinId, symbol, name, image,
      amount, buyPrice: price,
      conditionPct, duration, openingPrice,
    })
  }
  return apiRemoveHolding(holdingId, { amount, price, conditionPct, duration, openingPrice })
}

// Builds the "Trade complete" popup state for a winning trade.
export function settleWinningTrade(trade, coinSymbol) {
  const stakeAmount = parseFloat(trade.amount) || 0
  const directionLabel = directionLabelFor(trade)
  const profitAmount = calculateProfit(stakeAmount, trade.deliveryTime)
  const profitAmountText = num(profitAmount)

  return {
    trade,
    outcome: 'Profit',
    pct: Math.round((trade.conditionPct ?? 0) * 100),
    directionLabel,
    amountText: num(stakeAmount),
    profitAmount,
    profitAmountText,
    message: "You've won the trade",
  }
}

// Builds the "Trade complete" popup state for a losing trade.
export function settleLosingTrade(trade) {
  const stakeAmount = parseFloat(trade.amount) || 0
  const directionLabel = directionLabelFor(trade)
  const lossAmount = calculateLoss(stakeAmount)

  return {
    trade,
    outcome: 'Loss',
    pct: Math.round((trade.conditionPct ?? 0) * 100),
    directionLabel,
    amountText: trade.amount ? num(stakeAmount) : '0',
    profitAmount: 0,
    profitAmountText: num(0),
    lossAmount,
    message: 'You lost Trade',
  }
}
