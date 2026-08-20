import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGetDepositHistory } from '../../lib/backend'
import { num } from '../../lib/format'

// Short "Aug 13, 2026 · 15:42" style stamp used on the history card.
const fmtCardDate = (t) => {
  const d = new Date(t)
  const date = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${date} · ${time}`
}

const statusLabel = (status) => {
  if (status === 'completed') return 'Successful'
  if (status === 'failed') return 'Reject'
  return status
}

const statusBadgeClass = (status) =>
  'badge ' + (status === 'completed' ? 'badge-wd-completed' : status === 'failed' ? 'badge-wd-rejected' : 'badge-wd-pending')

function DepositCard({ d }) {
  return (
    <div className="history-card">
      <div className="history-card-top">
        <div className="history-card-icon-group">
          <span className="history-card-symbol">{d.currency}</span>
          <span className={statusBadgeClass(d.status)}>{statusLabel(d.status)}</span>
        </div>
        <div className="history-card-stake">{num(d.amount)}</div>
      </div>
      <div className="history-card-bottom">
        <div className="history-card-meta">
          {fmtCardDate(d.createdAt)}
          <br />
          Network: {d.network || '—'}
        </div>
      </div>
      {d.txId && <div className="history-card-address mono">Ref: {d.txId}</div>}
    </div>
  )
}

export default function DepositHistory() {
  const [deposits, setDeposits] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    apiGetDepositHistory().then(setDeposits).catch(() => setDeposits([]))
  }, [])

  const totalDeposited = useMemo(
    () => (deposits ?? []).reduce((sum, d) => sum + (d.status === 'completed' ? d.amount : 0), 0),
    [deposits]
  )

  const pendingAmount = useMemo(
    () => (deposits ?? []).reduce((sum, d) => sum + (d.status === 'pending' ? d.amount : 0), 0),
    [deposits]
  )

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow">Account</div>
          <h1>Deposit history</h1>
          <p>A record of deposit requests submitted to your account.</p>
        </div>
        <div>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/account/deposit')}>
            Make Deposit
          </button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="panel panel-pad">
          <div className="muted">Total Deposited</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{deposits === null ? '—' : num(totalDeposited)}</div>
          <div className="muted" style={{ marginTop: 6 }}>Sum of all successful deposit amounts</div>
        </div>
        <div className="panel panel-pad">
          <div className="muted">Pending Deposit</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{deposits === null ? '—' : num(pendingAmount)}</div>
          <div className="muted" style={{ marginTop: 6 }}>Sum of all pending deposit request amounts</div>
        </div>
      </div>

      <div className="history-cards">
        {deposits === null && <div className="muted">Loading…</div>}
        {deposits?.length === 0 && <div className="empty">No deposits yet.</div>}
        {deposits?.map((d) => (
          <DepositCard key={d.id} d={d} />
        ))}
      </div>
    </div>
  )
}
