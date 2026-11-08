import { Fragment, useEffect, useMemo, useState } from 'react'
import { apiAdminGetWithdrawRequests, apiAdminUpdateWithdrawStatus } from '../../lib/backend'
import { num } from '../../lib/format'
import StatCard from '../../components/StatCard'
import TransactionSlip, { SlipStatusPicker, fmtSlipDate, slipRef } from '../../components/TransactionSlip'

const initials = (name) =>
  (name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?'

const statusText = (status) => (status === 'completed' ? 'Completed' : status === 'failed' ? 'Rejected' : 'Pending')

const statusBadgeClass = (status) =>
  'badge ' + (status === 'completed' ? 'badge-wd-completed' : status === 'failed' ? 'badge-wd-rejected' : 'badge-wd-pending')

// Short "Aug 13, 2026 · 15:42" style stamp used on the history card.
const fmtCardDate = (t) => {
  const d = new Date(t)
  const date = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${date} · ${time}`
}

function WithdrawCard({ w, active, onViewDetails }) {
  return (
    <div className={'history-card' + (active ? ' history-card-active' : '')}>
      <div className="history-card-top">
        <div className="history-card-icon-group">
          <span className="avatar-circle">{initials(w.userName)}</span>
          <div style={{ minWidth: 0 }}>
            <div className="history-card-symbol">{w.userName}</div>
            <div className="muted" style={{ fontSize: 12 }}>{w.userEmail}</div>
          </div>
        </div>
        <span className={statusBadgeClass(w.status)}>{statusText(w.status)}</span>
      </div>
      <div className="history-card-bottom">
        <div className="history-card-meta">
          {fmtCardDate(w.createdAt)}
          <br />
          {w.currency} • Network: {w.network || '—'}
        </div>
        <div className="history-card-result">{num(w.amount)} {w.currency}</div>
      </div>
      <div className="history-card-address mono">{w.address || '—'}</div>
      <button
        className={'btn btn-sm' + (active ? ' btn-primary' : '')}
        style={{ width: '100%', marginTop: 12 }}
        onClick={() => onViewDetails(active ? null : w)}
      >
        {active ? 'Close' : 'View details'}
      </button>
    </div>
  )
}

function WithdrawSlip({ w }) {
  const rows = [
    ['Date & Time', fmtSlipDate(w.createdAt)],
    ['Request ID', slipRef('WD', w.id)],
    ['User Email', w.userEmail],
    ['Currency', `${w.currency} • ${w.network || '—'}`],
    ['Wallet Address', w.address || '—', true],
  ]
  if (w.fee != null) rows.push(['Fee', `${num(w.fee)} ${w.currency}`])
  if (w.txId) rows.push(['Transaction ID', w.txId, true])

  return (
    <TransactionSlip
      status={w.status}
      amount={w.amount}
      currency={w.currency}
      from="OnChainTrade Wallet"
      to={w.userName}
      badge={<span className={statusBadgeClass(w.status)}>{statusText(w.status)}</span>}
      fileName={`OnChainTrade-${slipRef('WD', w.id)}.png`}
      rows={rows}
    />
  )
}

function WithdrawDetailPanel({ w, detailStatus, onDetailStatusChange, onSave, busy, error }) {
  return (
    <div className="panel panel-pad wd-detail-panel">
      <h2 style={{ fontSize: 18 }}>Withdrawal request details</h2>
      <p className="muted mb-0">Showing the full request data submitted by the user.</p>

      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

      <div className="slip-detail-grid">
        {/* Shows the saved request only — it updates once Save succeeds. */}
        <WithdrawSlip w={w} />

        <div className="slip-controls">
          <div className="slip-controls-title">Update status</div>
          <div className="slip-controls-sub">Choose a status, then save to apply it.</div>
          <SlipStatusPicker value={detailStatus} onChange={onDetailStatusChange} />
          <button className="btn btn-primary btn-block" onClick={onSave} disabled={busy || detailStatus === w.status}>
            {busy ? 'Saving…' : 'Save status'}
          </button>
          {detailStatus !== w.status && (
            <div className="slip-controls-note" style={{ color: 'var(--amber)' }}>
              Unsaved changes — press Save status to apply them.
            </div>
          )}
          <div className="slip-controls-note">Rejecting refunds the reserved amount to the user's wallet.</div>
        </div>
      </div>
    </div>
  )
}

export default function Withdrawals() {
  const [withdraws, setWithdraws] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [selectedWithdraw, setSelectedWithdraw] = useState(null)
  const [detailStatus, setDetailStatus] = useState('pending')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    apiAdminGetWithdrawRequests().then(setWithdraws).catch(() => setWithdraws([]))
  }, [])

  useEffect(() => {
    if (!selectedWithdraw) {
      setDetailStatus('pending')
      return
    }

    setDetailStatus(selectedWithdraw.status)
  }, [selectedWithdraw])

  const filteredWithdraws = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (withdraws ?? []).filter((w) => {
      if (statusFilter !== 'all' && w.status !== statusFilter) return false
      if (!q) return true
      return w.userName?.toLowerCase().includes(q) || w.userEmail?.toLowerCase().includes(q)
    })
  }, [withdraws, search, statusFilter])

  const totals = useMemo(() => {
    const summary = { pending: 0, completed: 0, failed: 0, total: 0 }
    ;(withdraws ?? []).forEach((w) => {
      summary.total += 1
      if (w.status === 'pending') summary.pending += 1
      if (w.status === 'completed') summary.completed += 1
      if (w.status === 'failed') summary.failed += 1
    })
    return summary
  }, [withdraws])

  async function handleSaveDetails() {
    if (!selectedWithdraw) return
    setError('')
    setBusyId(selectedWithdraw.id)
    try {
      const updated = await apiAdminUpdateWithdrawStatus(
        selectedWithdraw.id,
        detailStatus
      )
      setWithdraws((prev) => prev?.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)))
      setSelectedWithdraw((prev) => (prev ? { ...prev, ...updated } : prev))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="eyebrow">Admin</div>
          <h1>Withdraw requests</h1>
          <p>Review withdrawal requests submitted by users.</p>
        </div>
      </div>

      <div className="stat-grid withdrawals-stat-grid" style={{ marginBottom: 20 }}>
        <StatCard label="TOTAL REQUESTS" value={withdraws === null ? '—' : String(totals.total)} />
        <StatCard label="PENDING" value={withdraws === null ? '—' : String(totals.pending)} />
        <StatCard label="COMPLETED" value={withdraws === null ? '—' : String(totals.completed)} />
        <StatCard label="REJECT" value={withdraws === null ? '—' : String(totals.failed)} />
      </div>

      <div className="panel panel-pad" style={{ marginBottom: 20 }}>
        <label className="wd-status-tabs-label">Filter by status</label>
        <div className="wd-status-tabs">
          {[
            { key: 'all', label: 'All', count: totals.total },
            { key: 'pending', label: 'Pending', count: totals.pending },
            { key: 'completed', label: 'Completed', count: totals.completed },
            { key: 'failed', label: 'Rejected', count: totals.failed },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={'btn btn-sm' + (statusFilter === tab.key ? ' btn-primary' : '')}
              onClick={() => setStatusFilter(tab.key)}
            >
              {tab.label} ({withdraws === null ? '—' : tab.count})
            </button>
          ))}
        </div>

        <div className="field mb-0" style={{ marginTop: 16 }}>
          <label htmlFor="withdraw-search">Search by user</label>
          <input
            id="withdraw-search"
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
          />
        </div>
      </div>

      {withdraws === null && <div className="muted">Loading…</div>}
      {filteredWithdraws.length === 0 && withdraws !== null && (
        <div className="empty">
          {search.trim()
            ? 'No withdrawal requests match that search.'
            : statusFilter !== 'all'
            ? `No ${statusText(statusFilter).toLowerCase()} withdrawal requests.`
            : 'No withdrawal requests have been submitted yet.'}
        </div>
      )}

      <div className="history-cards">
        {filteredWithdraws.map((w) => (
          <Fragment key={w.id}>
            <WithdrawCard w={w} active={selectedWithdraw?.id === w.id} onViewDetails={setSelectedWithdraw} />
            {selectedWithdraw?.id === w.id && (
              <WithdrawDetailPanel
                w={selectedWithdraw}
                detailStatus={detailStatus}
                onDetailStatusChange={setDetailStatus}
                onSave={handleSaveDetails}
                busy={busyId === selectedWithdraw.id}
                error={error}
              />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
