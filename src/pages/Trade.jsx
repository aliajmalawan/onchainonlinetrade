import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getMarkets, getCoinChart, getBinancePrice, SHORT_CHART_RANGES } from '../lib/api'
import { apiGetPortfolio } from '../lib/backend'
import CandleChart from '../components/CandleChart'
import { usd, num } from '../lib/format'
import { getProfitPercentage, updateWallet, settleWinningTrade, settleLosingTrade } from '../lib/trading'

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
  const [currentDateTime, setCurrentDateTime] = useState(new Date())
  const [tradeLivePrice, setTradeLivePrice] = useState(null)

  useEffect(() => {
    refreshUser().catch(() => {})
    getMarkets({ perPage: 100 }).then(setCoins).catch(() => {})
    refreshHoldings()
  }, [])

  // Keep live prices moving — this is what "Current price" in the trade
  // timer popup (and the rest of the page) reads from, so without a
  // refresh it would just be frozen at whatever loaded on page open.
  useEffect(() => {
    const id = setInterval(() => {
      getMarkets({ perPage: 100, ttlMs: 5000 }).then(setCoins).catch(() => {})
    }, 5000)
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

  // Sell can only offer coins the user actually holds.
  const sellableCoins = holdings.map((h) => priceById[h.coinId]).filter(Boolean)

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
  const heldHolding = holdingByCoin[coinId]
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
    setCoinId(next === 'buy' ? 'bitcoin' : sellableCoins[0]?.id || '')
    setAmount('')
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
    setCurrentDateTime(new Date())
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

    if (exec.side === 'sell') {
      const held = holdingByCoin[exec.coinId]
      if (!held) return "You don't hold this coin."
      if (amt > held.amount) return `You only hold ${num(held.amount)} ${coinToUse.symbol.toUpperCase()}.`
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

  function handleTradeComplete(trade, serverOutcome = null) {
    if (!trade) return
    const outcome = serverOutcome === 'Profit' ? 'Profit' : (serverOutcome === 'Loss' ? 'Loss' : (user?.profitMode ? 'Profit' : 'Loss'))
    const coinSymbol = priceById[trade.coinId]?.symbol?.toUpperCase() || ''
    const result = outcome === 'Profit' ? settleWinningTrade(trade, coinSymbol) : settleLosingTrade(trade)

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
    setAmount('')
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

    const sellHolding = holdingByCoin[exec.coinId]
    if (exec.side === 'sell') {
      if (!sellHolding) return setError("You don't hold this coin.")
      if (amt > sellHolding.amount) return setError(`You only hold ${num(sellHolding.amount)} ${coinToUse.symbol.toUpperCase()}.`)
    }

    setBusy(true)
    try {
      const execPrice = coinToUse.current_price
      const response = await updateWallet({
        side: exec.side,
        holdingId: sellHolding?.id,
        coinId: coinToUse.id,
        symbol: coinToUse.symbol,
        name: coinToUse.name,
        image: coinToUse.image,
        amount: amt,
        price: execPrice,
        conditionPct: exec.conditionPct ?? 0,
        duration: exec.deliveryTime ?? null,
        openingPrice: exec.purchasePrice ?? null,
      })
      setSuccess(
        exec.side === 'buy'
          ? `Bought ${num(amt)} ${coinToUse.symbol.toUpperCase()} at ${usd(execPrice)}.`
          : `Sold ${num(amt)} ${coinToUse.symbol.toUpperCase()} at ${usd(execPrice)}.`
      )
      setAmount('')
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
      setTradeTimerActive(false)
      setPendingTrade(null)
      if (completedTrade) {
        submit(completedTrade).then((response) => {
          handleTradeComplete(completedTrade, response?.result)
        }).catch(() => {
          handleTradeComplete(completedTrade, 'Loss')
        })
      }
      return
    }

    const timerId = setTimeout(() => {
      setTradeSecondsLeft((seconds) => seconds - 1)
      setCurrentDateTime(new Date())
    }, 1000)
    return () => clearTimeout(timerId)
  }, [tradeTimerActive, tradeSecondsLeft, pendingTrade])

  const coinList = side === 'buy' ? coins : sellableCoins
  const estTotal = livePrice != null && amount ? livePrice * parseFloat(amount) : null

  return (
    <div>
      {tradeTimerActive && (
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
                padding: 24,
                borderRadius: 18,
                width: 360,
                maxWidth: '95vw',
                textAlign: 'center',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
              }}
            >
              <button
                type="button"
                onClick={cancelTrade}
                aria-label="Cancel trade"
                title="Cancel trade"
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  background: '#f3f4f6',
                  color: '#374151',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
              {pendingTrade && priceById[pendingTrade.coinId] && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                  {priceById[pendingTrade.coinId].image && (
                    <img
                      src={priceById[pendingTrade.coinId].image}
                      alt=""
                      style={{ width: 24, height: 24, borderRadius: '50%' }}
                    />
                  )}
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                    {priceById[pendingTrade.coinId].name}{' '}
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>
                      ({priceById[pendingTrade.coinId].symbol?.toUpperCase()})
                    </span>
                  </span>
                </div>
              )}
              <div style={{ fontSize: 16, color: '#374151', marginBottom: 8 }}>Trade Timer</div>
              <div style={{ fontSize: 48, fontWeight: 700, color: '#111827' }}>{tradeSecondsLeft}</div>
              <div style={{ marginTop: 12, color: '#374151', fontWeight: 600 }}>
                Executing your {pendingTrade?.side === 'buy' ? 'Buy Long' : 'Sell Short'} trade.
              </div>
              <div style={{ marginTop: 18, textAlign: 'left', lineHeight: 1.8, color: '#334155', fontSize: 13.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>Purchase Price:</strong>
                  <span>{pendingTrade?.purchasePrice != null ? usd(pendingTrade.purchasePrice) : '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>Current Price:</strong>
                  <span>
                    {tradeLivePrice != null
                      ? usd(tradeLivePrice)
                      : pendingTrade
                      ? usd(priceById[pendingTrade.coinId]?.current_price ?? 0)
                      : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>Direction:</strong>
                  <span>{pendingTrade?.side === 'buy' ? 'Buy Long' : 'Sell Short'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>Amount:</strong>
                  <span>{pendingTrade?.amount ?? '—'} {pendingTrade?.coinId ? priceById[pendingTrade.coinId]?.symbol.toUpperCase() : ''}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>Delivery Time:</strong>
                  <span>{pendingTrade?.deliveryTime ?? 0} sec</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>Opened:</strong>
                  <span style={{ whiteSpace: 'nowrap' }}>{pendingTrade?.openedAt ? pendingTrade.openedAt.toLocaleString() : '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>Current Date & Time:</strong>
                  <span style={{ whiteSpace: 'nowrap' }}>{currentDateTime.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
      )}
      {tradeResultOpen && tradeResult && (
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
              padding: 24,
              borderRadius: 18,
              width: 380,
              maxWidth: '95vw',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
            }}
          >
            <div style={{ fontSize: 16, color: '#374151', marginBottom: 8 }}>Trade complete</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: tradeResult.outcome === 'Profit' ? '#16a34a' : '#dc2626' }}>
              {tradeResult.outcome === 'Profit'
                ? 'Profit'
                : `${tradeResult.amountText} ${priceById[tradeResult.trade.coinId]?.symbol?.toUpperCase() || ''}`}
            </div>
            <div style={{ marginTop: 10, color: '#334155', lineHeight: 1.6 }}>
              <div><strong>Direction:</strong> {tradeResult.directionLabel}</div>
              {tradeResult.outcome === 'Profit' ? (
                <div><strong>Amount:</strong> {tradeResult.amountText} {priceById[tradeResult.trade.coinId]?.symbol?.toUpperCase() || ''}</div>
              ) : null}
              {tradeResult.outcome === 'Profit' && (
                <div>
                  <strong>Profit:</strong> {tradeResult.profitAmountText} {priceById[tradeResult.trade.coinId]?.symbol?.toUpperCase() || ''}
                </div>
              )}
              <div style={{ marginTop: 8, color: tradeResult.outcome === 'Profit' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                {tradeResult.message}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20 }}>
              <button className="btn btn-sm" onClick={closeTradeResult}>
                Close
              </button>
              <button className="btn btn-sm btn-primary" onClick={continueTrade}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

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
            {side === 'sell' && sellableCoins.length === 0 && (
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                You don't hold any coins yet — buy something first.
              </div>
            )}
          </div>

          {coin && (
            <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Live price: {usd(livePrice)}
              {side === 'sell' && heldHolding && <> · You hold {num(heldHolding.amount)} {coin.symbol.toUpperCase()}</>}
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

            {estTotal != null && (
              <div className="muted" style={{ fontSize: 13 }}>
                Estimated total: {usd(estTotal)}
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
              <div className="spread" style={{ marginBottom: 14 }}>
                <div className="coin-cell">
                  <img src={coin.image} alt="" style={{ width: 26, height: 26 }} />
                  <div>
                    <strong>{coin.name}</strong> <span className="sym muted">{coin.symbol.toUpperCase()}</span>
                  </div>
                </div>
                <div className="row chart-range-row" style={{ flex: '0 0 auto' }}>
                  {SHORT_CHART_RANGES.map((r) => (
                    <button
                      key={r.label}
                      className={'btn btn-sm' + (range.label === r.label ? ' btn-primary' : '')}
                      onClick={() => setRange(r)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                Live candles from Binance / CoinGecko ({coin.symbol.toUpperCase()}/USDT)
              </div>

              {chartStatus === 'loading' && <div className="loading">Loading chart…</div>}
              {chartStatus === 'error' && (
                <div className="alert alert-error">{chartError || "Couldn't load chart data."}</div>
              )}
              {chartStatus === 'ready' && chart.length < 2 && (
                <div className="alert alert-info">Not enough data points at this range yet.</div>
              )}
              {chartStatus === 'ready' && chart.length >= 2 && <CandleChart data={chart} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
