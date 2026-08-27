import { Fragment, useEffect, useMemo, useState } from 'react'
import { apiAdminGetDepositRequests, apiAdminUpdateDepositStatus } from '../../lib/backend'

const ROOT = (import.meta.env.VITE_BACKEND_URL || '/api').replace(/\/api$/, '')
const qrUrl = (path) => (path ? ROOT + '/' + path.replace(/^\//, '') : null)
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

function DepositCard({ d, active, onViewDetails }) {
  return (
    <div className={'history-card' + (active ? ' history-card-active' : '')}>
      <div className="history-card-top">
        <div className="history-card-icon-group">
          <span className="avatar-circle">{initials(d.userName)}</span>
          <div style={{ minWidth: 0 }}>
            <div className="history-card-symbol">{d.userName}</div>
            <div className="muted" style={{ fontSize: 12 }}>{d.userEmail}</div>
          </div>
        </div>
        <span className={statusBadgeClass(d.status)}>{statusText(d.status)}</span>
      </div>
      <div className="history-card-bottom">
        <div className="history-card-meta">
          {fmtCardDate(d.createdAt)}
          <br />
          {d.currency} • Network: {d.network || '—'}
        </div>
        <div className="history-card-result">{num(d.amount)} {d.currency}</div>
      </div>
      {d.txId && <div className="history-card-address mono">Ref: {d.txId}</div>}
      <button
        className={'btn btn-sm' + (active ? ' btn-primary' : '')}
        style={{ width: '100%', marginTop: 12 }}
        onClick={() => onViewDetails(active ? null : d)}
      >
        {active ? 'Close' : 'View details'}
      </button>
    </div>
  )
}

function DepositDetailPanel({ d, detailStatus, onDetailStatusChange, detailAmount, onDetailAmountChange, onSave, busy, error }) {
  return (
    <div className="panel panel-pad wd-detail-panel">
      <h2 style={{ fontSize: 18 }}>Deposit request details</h2>
      <p className="muted mb-0">Showing the full request data submitted by the user.</p>

      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

      <div className="row" style={{ gap: 24, flexWrap: 'wrap', marginTop: 16 }}>
        <div style={{ flex: '1 1 320px' }}>
          <div className="field">
            <label>User</label>
            <div>{d.userName}</div>
            <div className="muted" style={{ fontSize: 12 }}>{d.userEmail}</div>
          </div>
          <div className="field">
            <label>Requested date</label>
            <div>{fmtDate(d.createdAt)}</div>
          </div>
          <div className="field">
            <label>Amount ({d.currency})</label>
            <input
              className="input"
              type="number"
              min="0"
              step="any"
              value={detailAmount}
              onChange={(e) => onDetailAmountChange(e.target.value)}
              placeholder="Enter the amount from the screenshot"
            />
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              The user no longer states an amount — set it here from the transaction screenshot.
            </div>
          </div>
          <div className="field">
            <label>Status</label>
            <div>{statusLabel(d.status)}</div>
          </div>
        </div>

        <div style={{ flex: '1 1 320px' }}>
          <div className="field">
            <label>Currency</label>
            <div>{d.currency}</div>
          </div>
          <div className="field">
            <label>Network</label>
            <div>{d.network || '—'}</div>
          </div>
          <div className="field">
            <label>Deposit address shown to user</label>
            <div className="mono" style={{ wordBreak: 'break-all' }}>{d.address || '—'}</div>
          </div>
          <div className="field">
            <label>Transaction ID / Reference</label>
            <div className="mono" style={{ wordBreak: 'break-all' }}>{d.txId || '—'}</div>
          </div>
          {d.txProofImage && (
            <div className="field">
              <label>Transaction Screenshot</label>
              <a href={qrUrl(d.txProofImage)} target="_blank" rel="noreferrer">
                <img
                  src={qrUrl(d.txProofImage)}
                  alt="Transaction proof"
                  style={{ maxWidth: 220, borderRadius: 8, border: '1px solid var(--line)' }}
                />
              </a>
            </div>
          )}
          <div className="field">
            <label>Status</label>
            <select className="input" value={detailStatus} onChange={(e) => onDetailStatusChange(e.target.value)}>
              <option value="pending">pending</option>
              <option value="completed">completed</option>
              <option value="failed">Reject</option>
            </select>
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              Setting this to "completed" credits {num(parseFloat(detailAmount) || 0)} {d.currency} to the user's holdings.
            </div>
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

export default function DepositRequests() {
  const [deposits, setDeposits] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [selectedDeposit, setSelectedDeposit] = useState(null)
  const [detailStatus, setDetailStatus] = useState('pending')
  const [detailAmount, setDetailAmount] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    apiAdminGetDepositRequests().then(setDeposits).catch(() => setDeposits([]))
  }, [])

  useEffect(() => {
    if (!selectedDeposit) {
      setDetailStatus('pending')
      setDetailAmount('')
      return
    }

    setDetailStatus(selectedDeposit.status)
    setDetailAmount(selectedDeposit.amount > 0 ? String(selectedDeposit.amount) : '')
  }, [selectedDeposit])

  const filteredDeposits = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (deposits ?? []).filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (!q) return true
      return d.userName?.toLowerCase().includes(q) || d.userEmail?.toLowerCase().includes(q)
    })
  }, [deposits, search, statusFilter])

  const totals = useMemo(() => {
    const summary = { pending: 0, completed: 0, failed: 0, total: 0 }
    ;(deposits ?? []).forEach((d) => {
      summary.total += 1
      if (d.status === 'pending') summary.pending += 1
      if (d.status === 'completed') summary.completed += 1
      if (d.status === 'failed') summary.failed += 1
    })
    return summary
  }, [deposits])

  async function handleSaveDetails() {
    if (!selectedDeposit) return
    setError('')
    setBusyId(selectedDeposit.id)
    try {
      const updated = await apiAdminUpdateDepositStatus(
        selectedDeposit.id,
        detailStatus,
        null,
        detailAmount === '' ? null : parseFloat(detailAmount)
      )
      setDeposits((prev) => prev?.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)))
      setSelectedDeposit((prev) => (prev ? { ...prev, ...updated } : prev))
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
          <h1>Deposit requests</h1>
          <p>Review deposit requests submitted by users.</p>
        </div>
      </div>

      <div className="stat-grid withdrawals-stat-grid" style={{ marginBottom: 20 }}>
        <StatCard label="TOTAL REQUESTS" value={deposits === null ? '—' : String(totals.total)} />
        <StatCard label="PENDING" value={deposits === null ? '—' : String(totals.pending)} />
        <StatCard label="COMPLETED" value={deposits === null ? '—' : String(totals.completed)} />
        <StatCard label="REJECT" value={deposits === null ? '—' : String(totals.failed)} />
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
              {tab.label} ({deposits === null ? '—' : tab.count})
            </button>
          ))}
        </div>

        <div className="field mb-0" style={{ marginTop: 16 }}>
          <label htmlFor="deposit-search">Search by user</label>
          <input
            id="deposit-search"
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
          />
        </div>
      </div>

      {deposits === null && <div className="muted">Loading…</div>}
      {filteredDeposits.length === 0 && deposits !== null && (
        <div className="empty">
          {search.trim()
            ? 'No deposit requests match that search.'
            : statusFilter !== 'all'
            ? `No ${statusText(statusFilter).toLowerCase()} deposit requests.`
            : 'No deposit requests have been submitted yet.'}
        </div>
      )}

      <div className="history-cards">
        {filteredDeposits.map((d) => (
          <Fragment key={d.id}>
            <DepositCard d={d} active={selectedDeposit?.id === d.id} onViewDetails={setSelectedDeposit} />
            {selectedDeposit?.id === d.id && (
              <DepositDetailPanel
                d={selectedDeposit}
                detailStatus={detailStatus}
                onDetailStatusChange={setDetailStatus}
                detailAmount={detailAmount}
                onDetailAmountChange={setDetailAmount}
                onSave={handleSaveDetails}
                busy={busyId === selectedDeposit.id}
                error={error}
              />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
