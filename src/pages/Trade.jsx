import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getMarkets, getCoinChart, getBinancePrice, SHORT_CHART_RANGES } from '../lib/api'
import { apiGetPortfolio } from '../lib/backend'
import CandleChart from '../components/CandleChart'
import { usd, num } from '../lib/format'
import { getProfitPercentage, calculateProfit, updateWallet, settleWinningTrade, settleLosingTrade } from '../lib/trading'

// Buy Long frames itself as "betting the price rises" and Sell Short as
// "betting it falls" — a live price that drifts the wrong way during/after
// the trade reads as contradictory, even though the actual Profit/Loss
// outcome is decided separately (by admin profit mode), not by real price
// movement. Mirror the raw tick's distance from the purchase price toward
// each direction's favorable side, so a Buy Long's shown price never dips
// below where it opened and a Sell Short's never rises above it — while
// still moving tick to tick with the real market's volatility.
function displayPriceForDirection(side, purchasePrice, rawPrice) {
  if (purchasePrice == null || rawPrice == null) return rawPrice
  const diff = Math.abs(rawPrice - purchasePrice)
  return side === 'sell' ? purchasePrice - diff : purchasePrice + diff
}

export default function Trade() {
  const { user, refreshUser } = useAuth()
  const [side, setSide] = useState('buy') // 'buy' | 'sell'
  const [coins, setCoins] = useState([])
  const [holdings, setHoldings] = useState([])
  const [coinId, setCoinId] = useState('bitcoin')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  const [range, setRange] = useState(SHORT_CHART_RANGES[3]) // default: 1h
  const [chart, setChart] = useState([])
  const [chartStatus, setChartStatus] = useState('idle')
  const [chartError, setChartError] = useState('')
  const [duration, setDuration] = useState(30) // trade duration in seconds
  const [tradeTimerActive, setTradeTimerActive] = useState(false)
  const [tradeSecondsLeft, setTradeSecondsLeft] = useState(0)
  const [pendingTrade, setPendingTrade] = useState(null)
  const [tradeResult, setTradeResult] = useState(null)
  const [tradeResultOpen, setTradeResultOpen] = useState(false)
  const [tradeLivePrice, setTradeLivePrice] = useState(null)

  useEffect(() => {
    refreshUser().catch(() => {})
    getMarkets({ perPage: 100 }).then(setCoins).catch(() => {})
    refreshHoldings()
  }, [])

  // Keeps the coin list / portfolio valuation reasonably fresh. Deliberately
  // NOT sub-10-second here — CoinGecko's free tier is rate-limited (~10-30
  // calls/min shared across every visitor), and a 5s poll with a matching 5s
  // cache TTL was hitting the network on almost every tick, which was
  // exhausting that limit and flooding the console with 429s. The trade
  // timer's actual "Current price" comes from Binance (below), which polls
  // every 2s with no such limit — this poll only needs to be fresh enough
  // for a dashboard-style price display.
  useEffect(() => {
    const id = setInterval(() => {
      getMarkets({ perPage: 100, ttlMs: 30_000 }).then(setCoins).catch(() => {})
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  function refreshHoldings() {
    apiGetPortfolio().then(setHoldings).catch(() => setHoldings([]))
  }

  const priceById = useMemo(() => {
    const map = {}
    coins.forEach((c) => (map[c.id] = c))
    return map
  }, [coins])

  // CoinGecko's snapshot only moves every ~5 minutes, so it can't show
  // real movement during a 30-300 second trade. Poll Binance's live ticker
  // instead, just for the coin being traded, while the timer is running.
  useEffect(() => {
    if (!tradeTimerActive || !pendingTrade) {
      setTradeLivePrice(null)
      return
    }
    const symbol = priceById[pendingTrade.coinId]?.symbol
    if (!symbol) return

    let cancelled = false
    function poll() {
      getBinancePrice(symbol)
        .then((price) => {
          if (!cancelled) setTradeLivePrice(price)
        })
        .catch(() => {})
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [tradeTimerActive, pendingTrade, priceById])

  const holdingByCoin = useMemo(() => {
    const map = {}
    holdings.forEach((h) => (map[h.coinId] = h))
    return map
  }, [holdings])

  // Every trade — Buy Long or Sell Short, on whichever coin is picked as the
  // {SYMBOL}/USDT price reference — is staked and settled in USDT alone, so
  // both directions read from the same USDT holding rather than the coin's.
  const usdtHolding = holdingByCoin['tether']
  const usdtRef = priceById['tether'] ?? { id: 'tether', symbol: 'usdt', name: 'Tether', image: null, current_price: 1 }

  // Same calculation as the Dashboard's "Portfolio value" stat.
  const portfolioValue = useMemo(() => {
    let value = 0
    holdings.forEach((h) => {
      const live = priceById[h.coinId]?.current_price
      if (live != null) value += live * h.amount
    })
    return value
  }, [holdings, priceById])

  const coin = priceById[coinId]
  const livePrice = coin?.current_price ?? null

  // Deliberately keyed on coinId (not the `coin` object) plus whether the
  // market list has loaded at all — `coins` gets a brand-new array/object
  // reference every 5s from the live-price poll above, so depending on
  // `coin` itself would restart this fetch on every single poll tick and
  // it would never get a clear ~1-2s window to actually finish.
  useEffect(() => {
    if (!coin) {
      setChart([])
      setChartStatus('idle')
      return
    }
    setChartStatus('loading')
    setChartError('')
    getCoinChart(coin, range.interval, range.limit)
      .then((data) => {
        setChart(data)
        setChartStatus('ready')
      })
      .catch((err) => {
        setChartError(err.message)
        setChartStatus('error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinId, range, coins.length > 0])

  function switchSide(next) {
    setSide(next)
    setCoinId((prev) => prev || 'bitcoin')
    // Amount deliberately stays as-is — this first click only "arms" the
    // side (a second click actually places the trade), so clearing it here
    // just made the user re-type what they'd already entered.
    setError('')
    setSuccess('')
  }

  function startTradeTimer(trade) {
    const purchasePrice = livePrice
    const conditionPct = trade?.conditionPct ?? getProfitPercentage(duration)
    const tradeToStart = {
      ...trade,
      purchasePrice,
      conditionPct,
      deliveryTime: duration,
      openedAt: new Date(),
    }
    setPendingTrade(tradeToStart)
    setTradeSecondsLeft(duration)
    setTradeTimerActive(true)
    setTradeResult(null)
    setTradeResultOpen(false)
  }

  function validateTrade(exec) {
    const coinToUse = priceById[exec.coinId]
    const amt = parseFloat(exec.amount)
    if (!coinToUse) return 'Pick a coin.'
    if (!(amt >= 100)) return 'Enter an amount of at least 100.'
    if (coinToUse.current_price == null) return 'Live price unavailable, try again shortly.'

    // Every trade is staked in USDT regardless of which pair it references,
    // so a Sell Short needs USDT margin on hand, not the referenced coin.
    if (exec.side === 'sell') {
      if (!usdtHolding) return "You don't hold any USDT."
      if (amt > usdtHolding.amount) return `You only hold ${num(usdtHolding.amount)} USDT.`
    }
    return true
  }

  // First click on a side switches into that mode (and resets the form to
  // the right coin list). Clicking the same side again starts the trade timer.
  function onSideClick(next) {
    if (side !== next) {
      switchSide(next)
      return
    }

    const trade = { side, coinId, amount }
    const valid = validateTrade(trade)
    if (valid !== true) {
      setError(valid)
      return
    }

    startTradeTimer(trade)
  }

  function handleTradeComplete(trade, serverOutcome = null, settlementPrice = null) {
    if (!trade) return
    const outcome = serverOutcome === 'Profit' ? 'Profit' : (serverOutcome === 'Loss' ? 'Loss' : (user?.profitMode ? 'Profit' : 'Loss'))
    const coinSymbol = priceById[trade.coinId]?.symbol?.toUpperCase() || ''
    const result = outcome === 'Profit' ? settleWinningTrade(trade, coinSymbol) : settleLosingTrade(trade)
    result.settlementPrice = settlementPrice

    setTradeResult(result)
    setTradeResultOpen(true)
  }

  function continueTrade() {
    if (!tradeResult?.trade) return
    const trade = tradeResult.trade
    setSide(trade.side)
    setCoinId(trade.coinId)
    setAmount(String(trade.amount))
    setTradeResult(null)
    setTradeResultOpen(false)
  }

  function closeTradeResult() {
    setTradeResult(null)
    setTradeResultOpen(false)
  }

  function cancelTrade() {
    setTradeTimerActive(false)
    setPendingTrade(null)
    setTradeSecondsLeft(0)
  }

  async function submit(trade = null) {
    setError('')
    setSuccess('')
    const exec = trade ?? { side, coinId, amount }
    const coinToUse = priceById[exec.coinId]
    const amt = parseFloat(exec.amount)
    if (!coinToUse) return setError('Pick a coin.')
    if (!(amt >= 100)) return setError('Enter an amount of at least 100.')
    if (coinToUse.current_price == null) return setError('Live price unavailable, try again shortly.')

    // The selected coin only supplies the {SYMBOL}/USDT price reference for
    // the timer/result popups — every trade is actually staked and settled
    // against the user's USDT holding, never the referenced coin's.
    if (exec.side === 'sell') {
      if (!usdtHolding) return setError("You don't hold any USDT.")
      if (amt > usdtHolding.amount) return setError(`You only hold ${num(usdtHolding.amount)} USDT.`)
    }

    setBusy(true)
    try {
      const execPrice = coinToUse.current_price
      const response = await updateWallet({
        side: exec.side,
        holdingId: usdtHolding?.id,
        coinId: usdtRef.id,
        symbol: usdtRef.symbol,
        name: usdtRef.name,
        image: usdtRef.image,
        amount: amt,
        price: 1,
        conditionPct: exec.conditionPct ?? 0,
        duration: exec.deliveryTime ?? null,
        openingPrice: exec.purchasePrice ?? null,
      })
      setSuccess(
        exec.side === 'buy'
          ? `Bought Long ${num(amt)} USDT on ${coinToUse.symbol.toUpperCase()}/USDT at ${usd(execPrice)}.`
          : `Sold Short ${num(amt)} USDT on ${coinToUse.symbol.toUpperCase()}/USDT at ${usd(execPrice)}.`
      )
      // Amount deliberately stays as-is — placing another trade at the same
      // stake shouldn't require re-typing it every time.
      refreshHoldings()
      return response
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!tradeTimerActive) return
    if (tradeSecondsLeft <= 0) {
      const completedTrade = pendingTrade
      const rawSettlementPrice = tradeLivePrice ?? priceById[completedTrade?.coinId]?.current_price ?? null
      const settlementPrice = displayPriceForDirection(completedTrade?.side, completedTrade?.purchasePrice, rawSettlementPrice)
      setTradeTimerActive(false)
      setPendingTrade(null)
      if (completedTrade) {
        submit(completedTrade).then((response) => {
          handleTradeComplete(completedTrade, response?.result, settlementPrice)
        }).catch(() => {
          handleTradeComplete(completedTrade, 'Loss', settlementPrice)
        })
      }
      return
    }

    const timerId = setTimeout(() => {
      setTradeSecondsLeft((seconds) => seconds - 1)
    }, 1000)
    return () => clearTimeout(timerId)
  }, [tradeTimerActive, tradeSecondsLeft, pendingTrade])

  // Both directions trade the same full market list — Sell Short doesn't
  // require owning the referenced coin, only enough USDT margin (checked
  // separately), since every trade settles in USDT regardless of pair.
  const coinList = coins
  // Amount is always staked in USDT now, so what's actually useful here is
  // the profit this trade would earn at the selected duration's fixed
  // percentage (e.g. 100 @ 30s's 10% -> 10), not a coin-quantity total.
  const amt = parseFloat(amount)
  const estProfit = amount && !Number.isNaN(amt) ? calculateProfit(amt, duration) : null

  return (
    <div>
      {tradeTimerActive && pendingTrade && (() => {
        const deliveryCoin = priceById[pendingTrade.coinId]
        const pairLabel = `${deliveryCoin?.symbol?.toUpperCase() ?? ''}/USDT`
        const isBuy = pendingTrade.side === 'buy'
        const directionColor = isBuy ? '#16a34a' : '#dc2626'
        const purchasePrice = pendingTrade.purchasePrice
        const rawCurrentPrice = tradeLivePrice != null ? tradeLivePrice : deliveryCoin?.current_price ?? null
        const currentPrice = displayPriceForDirection(pendingTrade.side, purchasePrice, rawCurrentPrice)
        let currentColor = '#111827'
        if (currentPrice != null && purchasePrice != null) {
          const favorable = isBuy ? currentPrice >= purchasePrice : currentPrice <= purchasePrice
          currentColor = favorable ? '#16a34a' : '#dc2626'
        }

        const totalSeconds = pendingTrade.deliveryTime || 1
        const fraction = Math.max(0, Math.min(1, tradeSecondsLeft / totalSeconds))
        const RADIUS = 42
        const CIRC = 2 * Math.PI * RADIUS
        const mm = String(Math.floor(tradeSecondsLeft / 60)).padStart(2, '0')
        const ss = String(tradeSecondsLeft % 60).padStart(2, '0')

        const openedAt = pendingTrade.openedAt
        const openedDate = openedAt ? openedAt.toLocaleDateString('en-US') : '—'
        const openedTime = openedAt ? openedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''

        const row = (label, value, color) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0' }}>
            <span style={{ color: '#6b7280', fontSize: 14 }}>{label}</span>
            <span style={{ color: color || '#111827', fontWeight: 700, fontSize: 14.5 }}>{value}</span>
          </div>
        )

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
            }}
          >
            <div
              style={{
                position: 'relative',
                background: '#fff',
                padding: '20px 24px 24px',
                borderRadius: 18,
                width: 380,
                maxWidth: '95vw',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid #eef1f6' }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>{pairLabel} Delivery</span>
                <button
                  type="button"
                  onClick={cancelTrade}
                  aria-label="Cancel trade"
                  title="Cancel trade"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#6b7280',
                    cursor: 'pointer',
                    fontSize: 20,
                    lineHeight: 1,
                    padding: 4,
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', padding: '26px 0' }}>
                <svg width={140} height={140} viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#dbeafe" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r={RADIUS}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={CIRC * (1 - fraction)}
                    transform="rotate(-90 50 50)"
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                  <text x="50" y="56" textAnchor="middle" fontSize="19" fontWeight="700" fill="#111827" fontFamily="inherit">
                    {mm}:{ss}
                  </text>
                </svg>
              </div>

              <div style={{ borderTop: '1px solid #eef1f6', borderBottom: '1px solid #eef1f6' }}>
                {row('Purchase price', purchasePrice != null ? usd(purchasePrice) : '—')}
                {row('Current price', currentPrice != null ? usd(currentPrice) : '—', currentColor)}
                {row('Direction', isBuy ? 'Buy Long' : 'Sell Short', directionColor)}
                {row('Amount', `${pendingTrade.amount ?? '—'} USDT`)}
                {row('Delivery time', `${pendingTrade.deliveryTime ?? 0}s`)}
              </div>

              <div style={{ paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 4 }}>
                  OPENED
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: '#111827' }}>
                  {openedDate} - {openedTime}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
      {tradeResultOpen && tradeResult && (() => {
        const trade = tradeResult.trade
        const resultCoin = priceById[trade.coinId]
        const pairLabel = `${resultCoin?.symbol?.toUpperCase() ?? ''}/USDT`
        const isProfit = tradeResult.outcome === 'Profit'
        const plColor = isProfit ? '#16a34a' : '#dc2626'
        const plValue = isProfit ? tradeResult.profitAmount : -(tradeResult.lossAmount ?? 0)
        const plText = `${plValue >= 0 ? '+' : ''}${plValue.toFixed(2)} USDT`

        const openedAt = trade.openedAt
        const openedDate = openedAt ? openedAt.toLocaleDateString('en-US') : '—'
        const openedTime = openedAt ? openedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''

        const row = (label, value) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0' }}>
            <span style={{ color: '#6b7280', fontSize: 14 }}>{label}</span>
            <span style={{ color: '#111827', fontWeight: 700, fontSize: 14.5 }}>{value}</span>
          </div>
        )

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: 20,
            }}
          >
            <div
              style={{
                background: '#fff',
                padding: '20px 24px 24px',
                borderRadius: 18,
                width: 380,
                maxWidth: '95vw',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid #eef1f6' }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>{pairLabel} Delivery</span>
                <button
                  type="button"
                  onClick={closeTradeResult}
                  aria-label="Close"
                  title="Close"
                  style={{ border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}
                >
                  ×
                </button>
              </div>

              <div style={{ textAlign: 'center', padding: '26px 0' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: plColor }}>P/L {plText}</div>
              </div>

              <div style={{ borderTop: '1px solid #eef1f6', borderBottom: '1px solid #eef1f6' }}>
                {row('Purchase price', trade.purchasePrice != null ? usd(trade.purchasePrice) : '—')}
                {row('Settlement price', tradeResult.settlementPrice != null ? usd(tradeResult.settlementPrice) : '—')}
                {row('Direction', tradeResult.directionLabel)}
                {row('Amount', `${trade.amount ?? '—'} USDT`)}
                {row('Delivery time', `${trade.deliveryTime ?? 0}s`)}
              </div>

              <div style={{ paddingTop: 14, paddingBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 4 }}>
                  OPENED
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: '#111827' }}>
                  {openedDate} - {openedTime}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={closeTradeResult}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    borderRadius: 10,
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    color: '#374151',
                    fontWeight: 700,
                    fontSize: 14.5,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={continueTrade}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    borderRadius: 10,
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14.5,
                    cursor: 'pointer',
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      <div className="page-head">
        <div className="eyebrow">Portfolio</div>
        <h1>Trade</h1>
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="trade-left-col">
          <div className="panel panel-pad trade-form-panel">
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-info">{success}</div>}

          <div className="field">
            <label>Coin</label>
            <select className="input" value={coinId} onChange={(e) => setCoinId(e.target.value)}>
              <option value="">Select…</option>
              {coinList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.symbol.toUpperCase()})
                </option>
              ))}
            </select>
            {side === 'sell' && !usdtHolding && (
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                You don't hold any USDT yet — buy something first.
              </div>
            )}
          </div>

          {coin && (
            <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Live price: {usd(livePrice)}
              {side === 'sell' && usdtHolding && <> · You hold {num(usdtHolding.amount)} USDT</>}
            </div>
          )}

          {/* Coin selector only — amount moved into duration panel */}

          {/* Buy/Sell buttons and tip moved into duration panel */}
        </div>

          <div className="panel panel-pad trade-duration-panel">
            <label style={{ display: 'block', marginBottom: 8 }}>Trade duration</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {[30, 60, 180, 300].map((s) => (
                <button
                  key={s}
                  className={'btn btn-sm' + (duration === s ? ' btn-primary' : '')}
                  onClick={() => setDuration(s)}
                >
                  {s} sec
                </button>
              ))}
            </div>

            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
              Est. Total Value (USD): {usd(portfolioValue)}
            </div>

            <div className="field" style={{ marginBottom: 8 }}>
              <label>Amount</label>
              <input
                className="input"
                type="number"
                min="100"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
              />
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Minimum amount: 100</div>
            </div>

            {estProfit != null && (
              <div className="muted" style={{ fontSize: 13 }}>
                Estimated Profit: {num(estProfit)} USDT
                <div>Est. returns +{(getProfitPercentage(duration) * 100).toFixed(2)}%</div>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <div className="row trade-side-buttons">
                <button
                  className={'btn' + (side === 'buy' ? ' btn-primary' : '')}
                  onClick={() => onSideClick('buy')}
                  disabled={busy || tradeTimerActive}
                >
                  {busy && side === 'buy' ? 'Placing trade…' : 'Buy Long'}
                </button>
                <button
                  className={'btn' + (side === 'sell' ? ' btn-primary' : '')}
                  onClick={() => onSideClick('sell')}
                  disabled={busy || tradeTimerActive}
                >
                  {busy && side === 'sell' ? 'Placing trade…' : 'Sell Short'}
                </button>
              </div>
              {!error && !success && (
                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  Tap {side === 'buy' ? 'Buy Long' : 'Sell Short'} again to place the trade.
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="panel panel-pad trade-chart-panel">
          {!coin && <div className="empty">Pick a coin to see its price chart.</div>}

          {coin && (
            <>
              {chartStatus === 'loading' && <div className="loading">Loading chart…</div>}
              {chartStatus === 'error' && (
                <div className="alert alert-error">{chartError || "Couldn't load chart data."}</div>
              )}
              {chartStatus === 'ready' && chart.length < 2 && (
                <div className="alert alert-info">Not enough data points at this range yet.</div>
              )}
              {chartStatus === 'ready' && chart.length >= 2 && (
                <CandleChart
                  data={chart}
                  coins={coins}
                  coinId={coinId}
                  onSelectCoin={setCoinId}
                  ranges={SHORT_CHART_RANGES}
                  activeRange={range}
                  onSelectRange={setRange}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
