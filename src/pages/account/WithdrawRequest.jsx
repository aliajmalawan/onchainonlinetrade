import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMarkets } from '../../lib/api'
import { apiGetPortfolio, apiSubmitWithdrawRequest } from '../../lib/backend'
import { usd, num } from '../../lib/format'

const CURRENCIES = ['BNB', 'BTC', 'ETH', 'USDT', 'SOL', 'USDC', 'XRP']
const NETWORKS = {
  BNB: ['BNB', 'BSC (BEP20)'],
  BTC: ['BTC'],
  ETH: ['ERC20'],
  SOL: ['SOL'],
  USDT: ['TRC20', 'ERC20', 'BEP20'],
  USDC: ['ERC20', 'SOL', 'BEP20'],
  XRP: ['XRP'],
}
const MIN_AMOUNT = 10

export default function WithdrawRequest() {
  const navigate = useNavigate()
  const [coins, setCoins] = useState([])
  const [holdings, setHoldings] = useState([])
  const [currency, setCurrency] = useState('USDT')
  const [network, setNetwork] = useState('TRC20')
  const [address, setAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [busy, setBusy] = useState(false)
  const popupTimerRef = useRef(null)

  useEffect(() => {
    getMarkets({ perPage: 100 }).then(setCoins).catch(() => {})
    apiGetPortfolio().then(setHoldings).catch(() => setHoldings([]))
  }, [])

  useEffect(() => {
    return () => clearTimeout(popupTimerRef.current)
  }, [])

  useEffect(() => {
    const defaultNetwork = NETWORKS[currency]?.[0] || ''
    setNetwork(defaultNetwork)
    // A different currency means a different balance — don't leave a
    // now-invalid amount from the previous currency lying around.
    setAmount('')
    setFieldErrors({})
  }, [currency])

  const balance = useMemo(() => {
    const match = holdings.find((h) => h.symbol?.toUpperCase() === currency)
    return match ? (match.amount || 0) : 0
  }, [holdings, currency])

  const selectedCoin = useMemo(() => coins.find((c) => c.symbol?.toUpperCase() === currency), [coins, currency])

  const estimatedValue = useMemo(() => {
    const amt = parseFloat(amount)
    if (!selectedCoin || !amt || amt <= 0 || selectedCoin.current_price == null) return null
    return amt * selectedCoin.current_price
  }, [amount, selectedCoin])

  const remainingBalance = useMemo(() => {
    const amt = parseFloat(amount)
    if (!amount || Number.isNaN(amt)) return null
    return balance - amt
  }, [amount, balance])

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
    if (!NETWORKS[currency]?.includes(network)) errs.network = 'Please select a valid network.'
    if (!address.trim()) errs.address = 'Recipient address is required.'
    const amt = parseFloat(amount)
    if (!amount || Number.isNaN(amt)) errs.amount = 'Enter a withdrawal amount.'
    else if (amt < MIN_AMOUNT) errs.amount = `Minimum withdrawal is ${MIN_AMOUNT.toFixed(2)} ${currency}.`
    else if (amt > balance) errs.amount = 'Requested amount exceeds available balance.'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    setSuccess('')
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length) return

    const amt = parseFloat(amount)
    setBusy(true)
    try {
      await apiSubmitWithdrawRequest({ currency, network, amount: amt, address })
      setSuccess(`Withdrawal request submitted. You have requested ${num(amt)} ${currency}. You will receive payment within 24 hours.`)
      setShowSuccessPopup(true)
      setAddress('')
      setAmount('')
      setFieldErrors({})
      apiGetPortfolio().then(setHoldings).catch(() => setHoldings([]))
      window.dispatchEvent(new CustomEvent('withdraw-requested'))
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
          <div className="eyebrow">Account</div>
          <h1>Withdraw funds</h1>
          <p>Submit a withdrawal request. Make sure network and wallet address match exactly.</p>
        </div>
        <Link to="/account/withdrawals" className="btn btn-secondary">
          Back to history
        </Link>
      </div>

      <div className="panel panel-pad" style={{ maxWidth: 640 }}>
        {formError && <div className="alert alert-error">{formError}</div>}
        {success && <div className="alert alert-info">{success}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label>Currency</label>
            <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="muted" style={{ fontSize: 12, marginTop: -8, marginBottom: 18 }}>
            Withdrawal methods currently support: BNB, BTC, ETH, SOL, USDC, USDT, XRP. If your funds are in other
            assets, please convert them first and then submit your withdrawal request.
          </div>

          <div className={'field' + (fieldErrors.network ? ' has-error' : '')}>
            <label>Withdrawal Network</label>
            <select
              className="input"
              value={network}
              onChange={(e) => {
                setNetwork(e.target.value)
                clearFieldError('network')
              }}
            >
              {(NETWORKS[currency] || []).map((net) => (
                <option key={net} value={net}>
                  {net}
                </option>
              ))}
            </select>
            {fieldErrors.network && <div className="field-error">{fieldErrors.network}</div>}
          </div>

          <div className="field">
            <label>Available Balance</label>
            <div className="input" style={{ paddingTop: 12, paddingBottom: 12, minHeight: 46 }}>
              {num(balance)} {currency}
            </div>
          </div>

          <div className={'field' + (fieldErrors.address ? ' has-error' : '')}>
            <label>Recipient Address</label>
            <input
              className="input"
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value)
                clearFieldError('address')
              }}
              placeholder="Wallet address"
            />
            {fieldErrors.address && <div className="field-error">{fieldErrors.address}</div>}
          </div>

          <div className={'field' + (fieldErrors.amount ? ' has-error' : '')}>
            <label>Amount ({currency})</label>
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
            {fieldErrors.amount ? (
              <div className="field-error">{fieldErrors.amount}</div>
            ) : (
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                Minimum withdrawal is {MIN_AMOUNT.toFixed(2)} {currency}.
              </div>
            )}
          </div>

          <div className="field">
            <label>Estimated Request Value</label>
            <div className="muted" style={{ fontSize: 13 }}>
              {estimatedValue != null ? (
                <>
                  ≈ {usd(estimatedValue)}
                  {remainingBalance != null && ` · Remaining after withdrawal: ${num(remainingBalance)} ${currency}`}
                </>
              ) : (
                '—'
              )}
            </div>
          </div>

          <div className="alert alert-warning">
            Please make sure the wallet address and network match before confirming any withdrawal. A wrong address or network may result in loss of funds, and the exchange will not be responsible.
          </div>

          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit Withdrawal Request'}
            </button>
          </div>
        </form>
      </div>
      {showSuccessPopup && (
        <div className="popup-overlay">
          <div className="popup-panel">
            <p>Your Withdrawal Request submitted Successfully</p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => navigate('/account/withdrawals')}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
