import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiGetDepositHistory } from '../../lib/backend'
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

function DepositCard({ d, active, onViewDetails }) {
  return (
    <div className={'history-card' + (active ? ' history-card-active' : '')}>
      <div className="history-card-top">
        <div className="history-card-icon-group">
          <span className="history-card-symbol">{d.currency}</span>
          <span className={statusBadgeClass(d.status)}>{statusLabel(d.status)}</span>
        </div>
        {/* Deposits are always credited as USDT, whatever coin was sent. */}
        <div className="history-card-stake">{num(d.amount)} USDT</div>
      </div>
      <div className="history-card-bottom">
        <div className="history-card-meta">
          {fmtCardDate(d.createdAt)}
          <br />
          Network: {d.network || '—'}
        </div>
      </div>
      {/* The slip is only offered once support has confirmed the deposit. */}
      {d.status === 'completed' && (
        <button
          className={'btn btn-sm' + (active ? ' btn-primary' : '')}
          style={{ width: '100%', marginTop: 12 }}
          onClick={() => onViewDetails(active ? null : d.id)}
        >
          {active ? 'Close' : 'View details'}
        </button>
      )}
    </div>
  )
}

function DepositSlipPanel({ d, user }) {
  return (
    <div className="panel panel-pad wd-detail-panel">
      <h2 style={{ fontSize: 18 }}>Deposit slip</h2>
      <p className="muted" style={{ marginBottom: 16 }}>Your confirmed deposit. Download it to keep a copy.</p>
      <TransactionSlip
        status={d.status}
        amount={d.amount}
        currency="USDT"
        from={user?.name}
        to="OnChainTrade Wallet"
        badge={<span className={statusBadgeClass(d.status)}>{statusLabel(d.status)}</span>}
        fileName={`OnChainTrade-${slipRef('DR', d.id, d.createdAt)}.png`}
        rows={[
          ['Date & Time', fmtSlipDate(d.createdAt)],
          ['Request ID', slipRef('DR', d.id, d.createdAt)],
          ['Email', user?.email || '—'],
          ['Paid With', `${d.currency} • ${d.network || '—'}`],
          ['Credited As', 'USDT'],
          ['Deposit Address', d.address || '—', true],
        ]}
      />
    </div>
  )
}

export default function DepositHistory() {
  const [deposits, setDeposits] = useState(null)
  const [openId, setOpenId] = useState(null)
  const { user } = useAuth()
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

      <div className="dh-stats">
        <HistoryStat
          tone="up"
          icon={<CheckIcon />}
          label="Total Deposited"
          value={deposits === null ? null : num(totalDeposited)}
          unit="USDT"
          hint="All successful deposits"
        />
        <HistoryStat
          tone="amber"
          icon={<ClockIcon />}
          label="Pending Deposit"
          value={deposits === null ? null : num(pendingAmount)}
          unit="USDT"
          hint="Waiting for confirmation"
        />
      </div>

      <div className="history-cards">
        {deposits === null && <div className="muted">Loading…</div>}
        {deposits?.length === 0 && <div className="empty">No deposits yet.</div>}
        {deposits?.map((d) => (
          <Fragment key={d.id}>
            <DepositCard d={d} active={openId === d.id} onViewDetails={setOpenId} />
            {openId === d.id && <DepositSlipPanel d={d} user={user} />}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
