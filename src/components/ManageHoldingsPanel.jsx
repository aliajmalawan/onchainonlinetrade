import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  apiAdminAddHolding,
  apiAdminGetUserHoldings,
  apiAdminUpdateHolding,
  apiAdminDeleteHolding,
  apiAdminUpdateModes,
} from '../lib/backend'
import { usd } from '../lib/format'

function HoldingRow({ h, onChanged }) {
  const [amount, setAmount] = useState(String(h.amount))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setError('')
    const amt = parseFloat(amount)
    if (!(amt > 0)) return setError('Amount must be > 0 — use Remove to delete it entirely.')
    setBusy(true)
    try {
      await apiAdminUpdateHolding(h.id, amt)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Remove ${h.name} holding entirely?`)) return
    setBusy(true)
    try {
      await apiAdminDeleteHolding(h.id)
      onChanged()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="row holding-row">
      <div className="holding-row-info coin-cell">
        {h.image && <img src={h.image} alt="" />}
        <div>
          {h.name} <span className="muted">({h.symbol.toUpperCase()})</span>
          <div className="muted" style={{ fontSize: 12 }}>bought at {usd(h.buyPrice)}</div>
        </div>
      </div>
      <div className="field mb-0 holding-row-amount">
        <input
          className="input"
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="holding-row-actions">
        <button className="btn btn-sm" onClick={save} disabled={busy || parseFloat(amount) === h.amount}>
          Save
        </button>
        <button className="btn btn-sm btn-danger" onClick={remove} disabled={busy}>
          Remove
        </button>
      </div>
      {error && <div className="alert alert-error" style={{ flexBasis: '100%' }}>{error}</div>}
    </div>
  )
}

// Admin can only add USDT holdings — restrict the picker to that one coin.
function AddHoldingForm({ userId, coins, onDone }) {
  const usdtCoins = coins.filter((c) => c.symbol?.toLowerCase() === 'usdt')
  const [coinId, setCoinId] = useState('')
  const [amount, setAmount] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function onCoinPick(id) {
    setCoinId(id)
    const live = usdtCoins.find((c) => c.id === id)?.current_price
    if (live != null && !buyPrice) setBuyPrice(String(live))
  }

  async function submit() {
    setError('')
    const coin = usdtCoins.find((c) => c.id === coinId)
    const amt = parseFloat(amount)
    const price = parseFloat(buyPrice)
    if (!coin) return setError('Pick a coin.')
    if (!(amt > 0)) return setError('Enter an amount greater than 0.')
    if (!(price > 0)) return setError('Enter a valid buy price.')

    setBusy(true)
    try {
      await apiAdminAddHolding(userId, {
        coinId: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        image: coin.image,
        amount: amt,
        buyPrice: price,
      })
      setCoinId('')
      setAmount('')
      setBuyPrice('')
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
        <select className="input" value={coinId} onChange={(e) => onCoinPick(e.target.value)}>
          <option value="">Select coin…</option>
          {usdtCoins.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.symbol.toUpperCase()})
            </option>
          ))}
        </select>
      </div>
      <div className="field mb-0">
        <input
          className="input"
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
        />
      </div>
      <div className="field mb-0">
        <input
          className="input"
          type="number"
          min="0"
          step="any"
          value={buyPrice}
          onChange={(e) => setBuyPrice(e.target.value)}
          placeholder="Buy price (USD)"
        />
      </div>
      <div className="field mb-0">
        <button className="btn btn-sm btn-primary" onClick={submit} disabled={busy}>
          {busy ? 'Adding…' : 'Add holding'}
        </button>
      </div>
    </div>
  )
}

export default function ManageHoldingsPanel({ user, coins, onModeChanged }) {
  const { user: me, refreshUser } = useAuth()
  const [holdings, setHoldings] = useState(null)
  const [busyMode, setBusyMode] = useState(false)
  const [profitMode, setProfitMode] = useState(!!user.profitMode)

  function refresh() {
    apiAdminGetUserHoldings(user.id).then(setHoldings).catch(() => setHoldings([]))
  }

  useEffect(() => {
    refresh()
  }, [user.id])

  useEffect(() => {
    setProfitMode(!!user.profitMode)
  }, [user.profitMode])

  async function toggleMode(mode, value) {
    setBusyMode(true)
    setProfitMode(value)
    try {
      const updatedUser = await apiAdminUpdateModes(user.id, { [mode]: value })
      refresh()
      if (me?.id === user.id) {
        await refreshUser().catch(() => {})
      }
      if (onModeChanged) {
        const modeLabel = mode === 'profitMode' ? 'Profit mode' : 'Loss mode'
        const status = value ? 'on' : 'off'
        const name = updatedUser?.name || user.name || 'user'
        onModeChanged(`${modeLabel} turned ${status} for ${name}.`)
      }
    } catch (err) {
      alert(err.message)
      setProfitMode(!!user.profitMode)
    } finally {
      setBusyMode(false)
    }
  }

  return (
    <div>
      <div className="holdings-panel-header">
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 6 }}>Holdings</h3>
          <div className="muted" style={{ fontSize: 13 }}>
            Profit Mood: {profitMode ? 'On' : 'Off'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
            <span>Mood</span>
            <span className="switch">
              <input
                type="checkbox"
                checked={profitMode}
                disabled={busyMode}
                onChange={(e) => toggleMode('profitMode', e.target.checked)}
              />
              <span className="slider round" />
            </span>
          </label>
        </div>
      </div>
      <div className="holdings-panel-list">
        {holdings === null && <div className="muted">Loading…</div>}
        {holdings?.length === 0 && <div className="muted">No holdings yet.</div>}
        {holdings?.map((h) => (
          <HoldingRow key={h.id} h={h} onChanged={refresh} />
        ))}
      </div>
      <div className="holdings-panel-add">
        <h4 className="holdings-panel-add-title">Add a holding</h4>
        <AddHoldingForm userId={user.id} coins={coins} onDone={refresh} />
      </div>
    </div>
  )
}
