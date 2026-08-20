import { Fragment, useEffect, useMemo, useState } from 'react'
import { apiAdminGetWithdrawRequests, apiAdminUpdateWithdrawStatus } from '../../lib/backend'
import { num } from '../../lib/format'
import StatCard from '../../components/StatCard'

const initials = (name) =>
  (name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?'

const statusLabel = (status) => {
  if (status === 'completed') return 'Successful'
  if (status === 'failed') return 'Reject'
  return status
}

const statusText = (status) => (status === 'completed' ? 'Completed' : status === 'failed' ? 'Rejected' : 'Pending')

const statusBadgeClass = (status) =>
  'badge ' + (status === 'completed' ? 'badge-wd-completed' : status === 'failed' ? 'badge-wd-rejected' : 'badge-wd-pending')

const fmtDate = (t) =>
  new Date(t).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

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

function WithdrawDetailPanel({ w, detailStatus, onDetailStatusChange, onSave, busy, error }) {
  return (
    <div className="panel panel-pad wd-detail-panel">
      <h2 style={{ fontSize: 18 }}>Withdrawal request details</h2>
      <p className="muted mb-0">Showing the full request data submitted by the user.</p>

      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

      <div className="row" style={{ gap: 24, flexWrap: 'wrap', marginTop: 16 }}>
        <div style={{ flex: '1 1 320px' }}>
          <div className="field">
            <label>User</label>
            <div>{w.userName}</div>
            <div className="muted" style={{ fontSize: 12 }}>{w.userEmail}</div>
          </div>
          <div className="field">
            <label>Requested date</label>
            <div>{fmtDate(w.createdAt)}</div>
          </div>
          <div className="field">
            <label>Amount</label>
            <div>{num(w.amount)} {w.currency}</div>
          </div>
          <div className="field">
            <label>Status</label>
            <div>{statusLabel(w.status)}</div>
          </div>
        </div>

        <div style={{ flex: '1 1 320px' }}>
          <div className="field">
            <label>Currency</label>
            <div>{w.currency}</div>
          </div>
          <div className="field">
            <label>Network / Wallet</label>
            <div>{w.network || w.address || '—'}</div>
          </div>
          <div className="field">
            <label>Network</label>
            <div>{w.network || '—'}</div>
          </div>
          <div className="field">
            <label>Wallet address</label>
            <div className="mono" style={{ wordBreak: 'break-all' }}>{w.address || '—'}</div>
          </div>
          <div className="field">
            <label>Status</label>
            <select className="input" value={detailStatus} onChange={(e) => onDetailStatusChange(e.target.value)}>
              <option value="pending">pending</option>
              <option value="completed">completed</option>
              <option value="failed">Reject</option>
            </select>
          </div>
          <div className="field" style={{ width: '100%' }}>
            <button className="btn btn-primary" onClick={onSave} disabled={busy}>
              {busy ? 'Saving…' : 'Save details'}
            </button>
          </div>
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
