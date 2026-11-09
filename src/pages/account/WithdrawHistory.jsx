import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiGetWithdrawHistory } from '../../lib/backend'
import { num } from '../../lib/format'
import TransactionSlip, { fmtSlipDate, slipRef } from '../../components/TransactionSlip'
import HistoryStat, { CheckIcon, ClockIcon } from '../../components/HistoryStat'

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

function WithdrawCard({ w, active, onViewDetails }) {
  return (
    <div className={'history-card' + (active ? ' history-card-active' : '')}>
      <div className="history-card-top">
        <div className="history-card-icon-group">
          <span className="history-card-symbol">{w.currency}</span>
          <span className={statusBadgeClass(w.status)}>{statusLabel(w.status)}</span>
        </div>
        <div className="history-card-stake">{num(w.amount)} {w.currency}</div>
      </div>
      <div className="history-card-bottom">
        <div className="history-card-meta">
          {fmtCardDate(w.createdAt)}
          <br />
          Network: {w.network || '—'}
        </div>
      </div>
      <div className="history-card-address mono">{w.address || '—'}</div>
      {/* The slip is only offered once the withdrawal has been paid out. */}
      {w.status === 'completed' && (
        <button
          className={'btn btn-sm' + (active ? ' btn-primary' : '')}
          style={{ width: '100%', marginTop: 12 }}
          onClick={() => onViewDetails(active ? null : w.id)}
        >
          {active ? 'Close' : 'View details'}
        </button>
      )}
    </div>
  )
}

function WithdrawSlipPanel({ w, user }) {
  const rows = [
    ['Date & Time', fmtSlipDate(w.createdAt)],
    ['Request ID', slipRef('WR', w.id, w.createdAt)],
    ['Email', user?.email || '—'],
    ['Currency', `${w.currency} • ${w.network || '—'}`],
    ['Wallet Address', w.address || '—', true],
  ]
  if (w.fee != null) rows.push(['Fee', `${num(w.fee)} ${w.currency}`])

  return (
    <div className="panel panel-pad wd-detail-panel">
      <h2 style={{ fontSize: 18 }}>Withdrawal slip</h2>
      <p className="muted" style={{ marginBottom: 16 }}>Your completed withdrawal. Download it to keep a copy.</p>
      <TransactionSlip
        status={w.status}
        amount={w.amount}
        currency={w.currency}
        from="OnChainTrade Wallet"
        to={user?.name}
        badge={<span className={statusBadgeClass(w.status)}>{statusLabel(w.status)}</span>}
        fileName={`OnChainTrade-${slipRef('WR', w.id, w.createdAt)}.png`}
        rows={rows}
      />
    </div>
  )
}

export default function WithdrawHistory() {
  const [withdraws, setWithdraws] = useState(null)
  const [openId, setOpenId] = useState(null)
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

  // Withdrawals can be in different coins; only label the totals with a
  // currency when every request used the same one.
  const totalsUnit = useMemo(() => {
    const currencies = new Set((withdraws ?? []).map((w) => w.currency))
    return currencies.size === 1 ? [...currencies][0] : null
  }, [withdraws])

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

      <div className="dh-stats">
        <HistoryStat
          tone="up"
          icon={<CheckIcon />}
          label="Total Withdrawn"
          value={withdraws === null ? null : num(totalWithdrawn)}
          unit={totalsUnit}
          hint="All successful withdrawals"
        />
        <HistoryStat
          tone="amber"
          icon={<ClockIcon />}
          label="Pending Withdrawal"
          value={withdraws === null ? null : num(pendingAmount)}
          unit={totalsUnit}
          hint="Waiting for confirmation"
        />
      </div>

      <div className="history-cards">
        {withdraws === null && <div className="muted">Loading…</div>}
        {withdraws?.length === 0 && <div className="empty">No withdrawals yet.</div>}
        {withdraws?.map((w) => (
          <Fragment key={w.id}>
            <WithdrawCard w={w} active={openId === w.id} onViewDetails={setOpenId} />
            {openId === w.id && <WithdrawSlipPanel w={w} user={user} />}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
