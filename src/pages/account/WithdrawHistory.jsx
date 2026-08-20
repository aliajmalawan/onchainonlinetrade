import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiGetWithdrawHistory } from '../../lib/backend'
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

function WithdrawCard({ w }) {
  return (
    <div className="history-card">
      <div className="history-card-top">
        <div className="history-card-icon-group">
          <span className="history-card-symbol">{w.currency}</span>
          <span className={statusBadgeClass(w.status)}>{statusLabel(w.status)}</span>
        </div>
        <div className="history-card-stake">{num(w.amount)}</div>
      </div>
      <div className="history-card-bottom">
        <div className="history-card-meta">
          {fmtCardDate(w.createdAt)}
          <br />
          Network: {w.network || '—'}
        </div>
      </div>
      <div className="history-card-address mono">{w.address || '—'}</div>
    </div>
  )
}

export default function WithdrawHistory() {
  const [withdraws, setWithdraws] = useState(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    apiGetWithdrawHistory().then(setWithdraws).catch(() => setWithdraws([]))
  }, [])

  const totalWithdrawn = useMemo(
    () => (withdraws ?? []).reduce((sum, w) => sum + (w.status === 'completed' ? w.amount : 0), 0),
    [withdraws]
  )

  const pendingAmount = useMemo(
    () => (withdraws ?? []).reduce((sum, w) => sum + (w.status === 'pending' ? w.amount : 0), 0),
    [withdraws]
  )

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow">Account</div>
          <h1>Withdraw history</h1>
          <p>A record of withdrawal requests from your account.</p>
        </div>
        <div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (user?.kycStatus !== 'verify') {
                alert('Your account is not identity-verified yet. Please complete KYC verification before submitting a withdrawal request.')
                return
              }
              navigate('/account/withdraw')
            }}
          >
            Make Withdrawal
          </button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="panel panel-pad">
          <div className="muted">Total Withdraw</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{withdraws === null ? '—' : num(totalWithdrawn)}</div>
          <div className="muted" style={{ marginTop: 6 }}>Sum of all successful withdrawal amounts</div>
        </div>
        <div className="panel panel-pad">
          <div className="muted">Pending Withdraw</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{withdraws === null ? '—' : num(pendingAmount)}</div>
          <div className="muted" style={{ marginTop: 6 }}>Sum of all pending withdrawal request amounts</div>
        </div>
      </div>

      <div className="history-cards">
        {withdraws === null && <div className="muted">Loading…</div>}
        {withdraws?.length === 0 && <div className="empty">No withdrawals yet.</div>}
        {withdraws?.map((w) => (
          <WithdrawCard key={w.id} w={w} />
        ))}
      </div>
    </div>
  )
}
