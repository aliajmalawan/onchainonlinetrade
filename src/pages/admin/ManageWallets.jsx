import { useEffect, useState } from 'react'
import {
  apiAdminGetDepositAddresses,
  apiAdminAddDepositAddress,
  apiAdminUpdateDepositAddress,
  apiAdminDeleteDepositAddress,
  apiAdminUploadDepositQr,
} from '../../lib/backend'

const ROOT = (import.meta.env.VITE_BACKEND_URL || '/api').replace(/\/api$/, '')
const qrUrl = (path) => (path ? ROOT + '/' + path.replace(/^\//, '') : null)

function DepositAddressRow({ a, onChanged }) {
  const [address, setAddress] = useState(a.address)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [qrBusy, setQrBusy] = useState(false)

  async function save() {
    setError('')
    if (!address.trim()) return setError('Address cannot be empty.')
    setBusy(true)
    try {
      await apiAdminUpdateDepositAddress(a.id, address.trim())
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Remove the ${a.currency} (${a.network}) deposit address?`)) return
    setBusy(true)
    try {
      await apiAdminDeleteDepositAddress(a.id)
      onChanged()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  async function uploadQr(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setQrBusy(true)
    try {
      await apiAdminUploadDepositQr(a.id, file)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setQrBusy(false)
      e.target.value = ''
    }
  }

  return (
    <div className="row holding-row">
      <div className="holding-row-info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {a.qrImage && (
          <img
            src={qrUrl(a.qrImage)}
            alt="QR"
            style={{ width: 36, height: 36, borderRadius: 6, border: '1px solid var(--line)', flex: '0 0 auto' }}
          />
        )}
        <div>
          {a.currency} <span className="muted">({a.network})</span>
        </div>
      </div>
      <div className="field mb-0 holding-row-amount">
        <input className="input mono" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="holding-row-actions">
        <button className="btn btn-sm" onClick={save} disabled={busy || address.trim() === a.address}>
          Save
        </button>
        <label className="btn btn-sm" style={{ cursor: 'pointer', marginBottom: 0 }}>
          {qrBusy ? 'Uploading…' : a.qrImage ? 'Change QR' : 'Upload QR'}
          <input type="file" accept="image/*" onChange={uploadQr} disabled={qrBusy} style={{ display: 'none' }} />
        </label>
        <button className="btn btn-sm btn-danger" onClick={remove} disabled={busy}>
          Remove
        </button>
      </div>
      {error && <div className="alert alert-error" style={{ flexBasis: '100%' }}>{error}</div>}
    </div>
  )
}

function AddDepositAddressForm({ onDone }) {
  const [currency, setCurrency] = useState('')
  const [network, setNetwork] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError('')
    if (!currency.trim() || !network.trim() || !address.trim()) {
      return setError('Currency, network and address are all required.')
    }
    setBusy(true)
    try {
      await apiAdminAddDepositAddress(currency.trim(), network.trim(), address.trim())
      setCurrency('')
      setNetwork('')
      setAddress('')
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="row">
      {error && <div className="alert alert-error" style={{ flexBasis: '100%' }}>{error}</div>}
      <div className="field mb-0">
        <input
          className="input"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          placeholder="Currency (e.g. USDT)"
        />
      </div>
      <div className="field mb-0">
        <input
          className="input"
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
          placeholder="Network (e.g. TRC20)"
        />
      </div>
      <div className="field mb-0">
        <input
          className="input mono"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Deposit address"
        />
      </div>
      <div className="field mb-0">
        <button className="btn btn-sm btn-primary" onClick={submit} disabled={busy}>
          {busy ? 'Adding…' : 'Add address'}
        </button>
      </div>
    </div>
  )
}

export default function ManageWallets() {
  const [addresses, setAddresses] = useState(null)

  function refresh() {
    apiAdminGetDepositAddresses().then(setAddresses).catch(() => setAddresses([]))
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Admin</div>
        <h1>Manage Wallets</h1>
        <p>These are the addresses shown to users on the Deposit Funds form. Add a new currency/network here whenever deposits should support it.</p>
      </div>

      <div className="panel panel-pad">
        {addresses === null && <div className="muted">Loading…</div>}
        {addresses?.length === 0 && <div className="muted" style={{ marginBottom: 10 }}>No wallet addresses configured yet.</div>}
        {addresses?.map((a) => (
          <DepositAddressRow key={a.id} a={a} onChanged={refresh} />
        ))}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <AddDepositAddressForm onDone={refresh} />
        </div>
      </div>
    </div>
  )
}
