import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMarkets } from '../lib/api'
import { apiGetPortfolio, apiConvert } from '../lib/backend'
import { usd, num } from '../lib/format'

export default function Convert() {
  const navigate = useNavigate()
  const [coins, setCoins] = useState([])
  const [holdings, setHoldings] = useState([])
  const [coinId, setCoinId] = useState('')
  const [amount, setAmount] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [busy, setBusy] = useState(false)

  function refresh() {
    getMarkets({ perPage: 100 }).then(setCoins).catch(() => {})
    apiGetPortfolio().then(setHoldings).catch(() => setHoldings([]))
  }

  useEffect(refresh, [])

  const priceById = useMemo(() => {
    const map = {}
    coins.forEach((c) => (map[c.id] = c))
    return map
  }, [coins])

  // Anything held except USDT itself — converting USDT to USDT is a no-op.
  const convertibleHoldings = useMemo(
    () => holdings.filter((h) => h.coinId !== 'tether' && h.amount > 0),
    [holdings]
  )

  useEffect(() => {
    if (!coinId && convertibleHoldings.length) setCoinId(convertibleHoldings[0].coinId)
  }, [coinId, convertibleHoldings])

  const selectedHolding = convertibleHoldings.find((h) => h.coinId === coinId)
  const selectedCoin = priceById[coinId]
  const livePrice = selectedCoin?.current_price ?? null
  const balance = selectedHolding?.amount || 0

  const estimatedUsdt = useMemo(() => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0 || livePrice == null) return null
    return amt * livePrice
  }, [amount, livePrice])

  function clearFieldError(field) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function handleAmountChange(e) {
    let v = e.target.value
    if (v !== '') {
      const n = parseFloat(v)
      if (!Number.isNaN(n) && n > balance) v = String(balance)
    }
    setAmount(v)
    clearFieldError('amount')
  }

  function handleMax() {
    if (balance <= 0) return
    setAmount(String(balance))
    clearFieldError('amount')
  }

  function validate() {
    const errs = {}
    if (!selectedHolding) errs.coin = 'Pick a coin you hold.'
    const amt = parseFloat(amount)
    if (!amount || Number.isNaN(amt) || amt <= 0) errs.amount = 'Enter an amount to convert.'
    else if (amt > balance) errs.amount = 'Amount exceeds your available balance.'
    if (livePrice == null) errs.amount = 'Live price unavailable, try again shortly.'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length) return

    const amt = parseFloat(amount)
    setBusy(true)
    try {
      await apiConvert({
        coinId,
        symbol: selectedCoin.symbol,
        name: selectedCoin.name,
        amount: amt,
        price: livePrice,
      })
      setShowSuccessPopup(true)
      setAmount('')
      setFieldErrors({})
      refresh()
    } catch (err) {
      setFormError(err.message)
      setShowSuccessPopup(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow">Wallet</div>
          <h1>Convert</h1>
          <p>Convert any coin you hold into USDT at the current live price.</p>
        </div>
        <Link to="/wallet" className="btn btn-secondary">
          Back to wallet
        </Link>
      </div>

      <div className="panel panel-pad" style={{ maxWidth: 520 }}>
        {formError && <div className="alert alert-error">{formError}</div>}

        {convertibleHoldings.length === 0 ? (
          <div className="empty">
            You don't hold any convertible coins yet. <Link to="/trade">Buy your first coin →</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label>From</label>
              <select className="input" value={coinId} onChange={(e) => { setCoinId(e.target.value); setAmount(''); clearFieldError('amount') }}>
                {convertibleHoldings.map((h) => (
                  <option key={h.coinId} value={h.coinId}>
                    {h.name} ({h.symbol.toUpperCase()})
                  </option>
                ))}
              </select>
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                Available: {num(balance)} {selectedCoin?.symbol?.toUpperCase() || ''}
              </div>
            </div>

            <div className={'field' + (fieldErrors.amount ? ' has-error' : '')}>
              <label>Amount ({selectedCoin?.symbol?.toUpperCase() || ''})</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max={balance}
                  step="any"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="Enter amount"
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn btn-sm" onClick={handleMax} disabled={balance <= 0}>
                  Max
                </button>
              </div>
              {fieldErrors.amount && <div className="field-error">{fieldErrors.amount}</div>}
            </div>

            <div className="field">
              <label>To</label>
              <div className="input" style={{ paddingTop: 12, paddingBottom: 12, minHeight: 46 }}>
                USDT (Dollars)
              </div>
            </div>

            <div className="field">
              <label>You will receive</label>
              <div className="muted" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                {estimatedUsdt != null ? `≈ ${usd(estimatedUsdt)} USDT` : '—'}
              </div>
            </div>

            <button className="btn btn-primary" type="submit" disabled={busy || !selectedHolding}>
              {busy ? 'Converting…' : 'Convert'}
            </button>
          </form>
        )}
      </div>
      {showSuccessPopup && (
        <div className="popup-overlay">
          <div className="popup-panel">
            <p>Your conversion was completed successfully.</p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => navigate('/wallet')}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
