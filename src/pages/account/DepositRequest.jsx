import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiGetDepositAddresses, apiSubmitDepositRequest } from '../../lib/backend'

const MIN_AMOUNT = 10
const ROOT = (import.meta.env.VITE_BACKEND_URL || '/api').replace(/\/api$/, '')
const qrUrl = (path) => (path ? ROOT + '/' + path.replace(/^\//, '') : null)

export default function DepositRequest() {
  const navigate = useNavigate()
  const [addresses, setAddresses] = useState(null)
  const [currency, setCurrency] = useState('')
  const [network, setNetwork] = useState('')
  const [amount, setAmount] = useState('')
  const [txId, setTxId] = useState('')
  const [proofFile, setProofFile] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    apiGetDepositAddresses().then(setAddresses).catch(() => setAddresses([]))
  }, [])

  // Currency + network options are entirely driven by whatever addresses an
  // admin has configured — adding a new currency there is all it takes for
  // it to show up here too.
  const currencies = useMemo(() => [...new Set((addresses ?? []).map((a) => a.currency))], [addresses])

  const networksForCurrency = useMemo(
    () => (addresses ?? []).filter((a) => a.currency === currency),
    [addresses, currency]
  )

  useEffect(() => {
    if (!currency && currencies.length) setCurrency(currencies[0])
  }, [currency, currencies])

  useEffect(() => {
    if (!currency) return
    const options = (addresses ?? []).filter((a) => a.currency === currency)
    if (!options.some((a) => a.network === network)) {
      setNetwork(options[0]?.network || '')
    }
  }, [currency, addresses]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedAddress = (addresses ?? []).find((a) => a.currency === currency && a.network === network)
  const depositAddress = selectedAddress?.address || ''

  function clearFieldError(field) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function validate() {
    const errs = {}
    const amt = parseFloat(amount)
    if (!amount || Number.isNaN(amt)) errs.amount = 'Enter a deposit amount.'
    else if (amt < MIN_AMOUNT) errs.amount = `Minimum deposit is ${MIN_AMOUNT.toFixed(2)} ${currency}.`
    if (!txId.trim()) errs.txId = 'Transaction ID / reference is required.'
    if (!proofFile) errs.proofFile = 'Upload a screenshot of the transaction.'
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
      await apiSubmitDepositRequest({ currency, network, amount: amt, txId, proofFile })
      setShowSuccessPopup(true)
      setAmount('')
      setTxId('')
      setProofFile(null)
      setFieldErrors({})
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
          <h1>Deposit funds</h1>
          <p>Send funds to the address below, then submit a deposit request so we can credit your account.</p>
        </div>
        <Link to="/account/deposits" className="btn btn-secondary">
          Back to history
        </Link>
      </div>

      <div className="panel panel-pad" style={{ maxWidth: 640 }}>
        {formError && <div className="alert alert-error">{formError}</div>}

        {addresses !== null && currencies.length === 0 && (
          <div className="alert alert-warning">
            No deposit currencies are available yet. Please check back later.
          </div>
        )}

        {(addresses === null || currencies.length > 0) && (
          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label>Currency</label>
              <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={addresses === null}>
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Deposit Network</label>
              <select className="input" value={network} onChange={(e) => setNetwork(e.target.value)} disabled={addresses === null}>
                {networksForCurrency.map((a) => (
                  <option key={a.network} value={a.network}>
                    {a.network}
                  </option>
                ))}
              </select>
            </div>

            {selectedAddress?.qrImage && (
              <div className="field" style={{ textAlign: 'center' }}>
                <label>Scan to Deposit</label>
                <img
                  src={qrUrl(selectedAddress.qrImage)}
                  alt={`${currency} ${network} deposit QR code`}
                  style={{ width: 180, height: 180, borderRadius: 8, border: '1px solid var(--line)', background: '#fff', padding: 8 }}
                />
              </div>
            )}

            <div className="field">
              <label>Deposit Address</label>
              <div className="input mono" style={{ paddingTop: 12, paddingBottom: 12, minHeight: 46, wordBreak: 'break-all' }}>
                {depositAddress || '—'}
              </div>
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                Send {currency} ({network}) to this address only.
              </div>
            </div>

            <div className={'field' + (fieldErrors.amount ? ' has-error' : '')}>
              <label>Amount ({currency})</label>
              <input
                className="input"
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  clearFieldError('amount')
                }}
                placeholder="Enter amount"
              />
              {fieldErrors.amount ? (
                <div className="field-error">{fieldErrors.amount}</div>
              ) : (
                <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                  Minimum deposit is {MIN_AMOUNT.toFixed(2)} {currency}.
                </div>
              )}
            </div>

            <div className={'field' + (fieldErrors.txId ? ' has-error' : '')}>
              <label>Transaction ID / Reference</label>
              <input
                className="input"
                type="text"
                value={txId}
                onChange={(e) => {
                  setTxId(e.target.value)
                  clearFieldError('txId')
                }}
                placeholder="Transaction hash"
              />
              {fieldErrors.txId && <div className="field-error">{fieldErrors.txId}</div>}
            </div>

            <div className={'field file-field' + (fieldErrors.proofFile ? ' has-error' : '')}>
              <div className="field-label-row">
                <label>Transaction Screenshot</label>
                <span className="file-hint">{proofFile ? proofFile.name : 'No file selected'}</span>
              </div>
              <label className="file-picker">
                <span>{proofFile ? 'Change file' : 'Choose file'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    setProofFile(e.target.files[0] ?? null)
                    clearFieldError('proofFile')
                  }}
                />
              </label>
              {fieldErrors.proofFile && <div className="field-error">{fieldErrors.proofFile}</div>}
            </div>

            <div className="alert alert-warning">
              Only send {currency} on the selected network to the address above. Sending a different asset or
              using the wrong network may result in permanent loss of funds.
            </div>

            <div style={{ textAlign: 'center' }}>
              <button className="btn btn-primary" type="submit" disabled={busy || !depositAddress}>
                {busy ? 'Submitting…' : 'Submit Deposit Request'}
              </button>
            </div>
          </form>
        )}
      </div>
      {showSuccessPopup && (
        <div className="popup-overlay">
          <div className="popup-panel">
            <p>Your Deposit Request submitted Successfully</p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => navigate('/account/deposits')}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
