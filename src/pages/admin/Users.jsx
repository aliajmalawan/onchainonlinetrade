import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  apiGetUsers,
  apiDeleteUser,
  apiAdminUpdateVerified,
  apiAdminUpdateKycStatus,
  apiAdminGetUserKyc,
  apiAdminGetUserSessions,
} from '../../lib/backend'
import { getMarkets } from '../../lib/api'
import ManageHoldingsPanel from '../../components/ManageHoldingsPanel'

const ICON_PATHS = {
  holdings: (
    <>
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1" />
      <path d="M21 12h-4a2 2 0 0 0 0 4h4v-4Z" />
    </>
  ),
  docs: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </>
  ),
  login: (
    <>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
}

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name]}
    </svg>
  )
}

function IconButton({ icon, active, danger, ...props }) {
  const cls = ['btn', 'btn-sm', 'btn-icon', 'btn-icon-' + icon]
  if (active) cls.push('btn-icon-active')
  if (danger) cls.push('btn-danger')
  return (
    <button className={cls.join(' ')} {...props}>
      <Icon name={icon} />
    </button>
  )
}

// Turns a raw User-Agent string into a short "Browser on OS" label —
// enough for an admin to recognize a device at a glance, no full UA
// parsing library needed for that.
function describeDevice(ua) {
  if (!ua) return 'Unknown device'

  let os = 'Unknown OS'
  if (/windows/i.test(ua)) os = 'Windows'
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS'
  else if (/android/i.test(ua)) os = 'Android'
  else if (/mac os x/i.test(ua)) os = 'macOS'
  else if (/linux/i.test(ua)) os = 'Linux'

  let browser = 'Unknown browser'
  if (/edg\//i.test(ua)) browser = 'Edge'
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = 'Opera'
  else if (/chrome\//i.test(ua)) browser = 'Chrome'
  else if (/firefox\//i.test(ua)) browser = 'Firefox'
  else if (/safari\//i.test(ua)) browser = 'Safari'

  return `${browser} on ${os}`
}

function SessionsPanel({ userId }) {
  const [sessions, setSessions] = useState(null)

  useEffect(() => {
    apiAdminGetUserSessions(userId).then(setSessions).catch(() => setSessions([]))
  }, [userId])

  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
      <h3 style={{ fontSize: 14, marginBottom: 6 }}>Login activity</h3>
      {sessions === null && <div className="muted" style={{ fontSize: 13 }}>Loading sessions…</div>}
      {sessions?.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No login sessions recorded yet.</div>}
      {sessions?.map((s, i) => (
        <div
          key={i}
          className="history-card"
          style={{ marginTop: i === 0 ? 8 : 8, marginBottom: 0 }}
        >
          <div className="history-card-top">
            <div className="history-card-icon-group">
              <div>
                <div className="history-card-symbol">{describeDevice(s.userAgent)}</div>
                <div className="muted" style={{ fontSize: 12 }}>{s.ip || 'Unknown IP'}</div>
              </div>
            </div>
            <span className={'badge ' + (s.active ? 'badge-wd-completed' : 'badge-user')}>
              {s.active ? 'Active' : 'Expired'}
            </span>
          </div>
          <div className="history-card-bottom">
            <div className="history-card-meta">{s.location || 'Location unavailable'}</div>
            <div className="history-card-result" style={{ fontSize: 12, fontWeight: 400 }}>
              {new Date(s.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function KycPanel({ userId, user, onChangeStatus, busy }) {
  const [kyc, setKyc] = useState(null)
  const ROOT = (import.meta.env.VITE_BACKEND_URL || '/api').replace(/\/api$/, '')

  useEffect(() => {
    apiAdminGetUserKyc(userId).then((rows) => setKyc(rows)).catch(() => setKyc([]))
  }, [userId, user?.kycStatus])

  if (kyc === null) return <div style={{ marginTop: 12 }} className="muted">Loading KYC…</div>

  const kycStatus = user?.kycStatus ?? 'unverify'
  const verifiedLabel =
    kycStatus === 'rejected'
      ? 'Account rejected'
      : kycStatus === 'verify'
      ? 'Verified account'
      : 'Unverified account'
  const accountStatus = kycStatus === 'rejected' ? 'rejected' : kycStatus === 'verify' ? 'verified' : 'unverified'

  const img = (p) => (p ? (ROOT + '/' + p.replace(/^\//, '')) : null)

  return (
    <div className="kyc-panel-body">
      <div className="kyc-panel-toprow">
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 6 }}>KYC documents</h3>
          <div className="muted" style={{ fontSize: 13 }}>{verifiedLabel} — Account: {accountStatus}</div>
        </div>
        {user?.role !== 'admin' && (
          <select
            className="input kyc-panel-status-select"
            value={kycStatus}
            onChange={(e) => onChangeStatus(e.target.value)}
            disabled={busy}
          >
            <option value="verify">Verify</option>
            <option value="unverify">Unverify</option>
            <option value="rejected">Rejected</option>
          </select>
        )}
      </div>
      {!kyc.length ? (
        <div className="muted kyc-panel-empty">No KYC submissions.</div>
      ) : (
        kyc.map((entry) => (
          <div key={entry.id} className="row kyc-entry-row">
            <div className="kyc-entry-info">
              <div className="muted" style={{ fontSize: 12 }}>Type</div>
              <div>{entry.idType}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Status</div>
              <div>{user?.kycStatus === 'verify' ? 'Verified' : user?.kycStatus === 'rejected' ? 'Rejected' : entry.status === 'pending' ? 'Pending' : entry.status}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Submitted</div>
              <div>{new Date(entry.createdAt).toLocaleString()}</div>
            </div>
            <div className="kyc-entry-images">
              {entry.frontPath && <img src={img(entry.frontPath)} alt="front" />}
              {entry.backPath && <img src={img(entry.backPath)} alt="back" />}
              {entry.selfiePath && <img src={img(entry.selfiePath)} alt="selfie" />}
            </div>
          </div>
        ))
      )}
      <SessionsPanel userId={userId} />
    </div>
  )
}

export default function Users() {
  const { user: me, impersonate, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [coins, setCoins] = useState([])
  const [openFor, setOpenFor] = useState(null)
  const [docsFor, setDocsFor] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState({})
  const [verifying, setVerifying] = useState({})
  const [statusMessage, setStatusMessage] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')

  function refresh() {
    apiGetUsers().then(setUsers).catch(() => setUsers([]))
  }

  useEffect(() => {
    refresh()
    getMarkets({ perPage: 100 }).then(setCoins).catch(() => {})
  }, [])

  useEffect(() => {
    if (!statusMessage) return
    const timeout = setTimeout(() => setStatusMessage(''), 5000)
    return () => clearTimeout(timeout)
  }, [statusMessage])

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDeleteUser(deleteTarget.id)
      refresh()
      setDeleteTarget(null)
    } catch (err) {
      alert(err.message)
    } finally {
      setDeleting(false)
    }
  }

  async function loginAs(u) {
    await impersonate(u.id)
    navigate('/dashboard')
  }

  async function changeUserKycStatus(u, nextStatus) {
    setUpdatingStatus((prev) => ({ ...prev, [u.id]: true }))
    try {
      await apiAdminUpdateKycStatus(u.id, nextStatus)
      refresh()
      if (u.id === me.id) {
        await refreshUser().catch(() => {})
      }
      setStatusMessage(`KYC status for ${u.name} updated to ${nextStatus}.`)
    } catch (err) {
      alert(err.message)
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [u.id]: false }))
    }
  }

  const nonAdminUsers = useMemo(() => users.filter((u) => u.role !== 'admin'), [users])

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return nonAdminUsers
    return nonAdminUsers.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q)
    )
  }, [nonAdminUsers, search])

  const fmtDate = (t) => new Date(t).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const initials = (name) =>
    (name || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Admin · Users</div>
        <h1>User management</h1>
      </div>

      {statusMessage && <div className="alert alert-info" style={{ marginBottom: 12 }}>{statusMessage}</div>}

      <div className="panel panel-pad" style={{ marginBottom: 16 }}>
        <div className="field mb-0">
          <label htmlFor="users-search">Search</label>
          <input
            id="users-search"
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or phone…"
          />
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="empty">No users match that search.</div>
      ) : (
      <div className="panel table-wrap">
        <table className="data users-table stack-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>KYC Status</th>
              <th>Mood</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <Fragment key={u.id}>
                <tr>
                  <td data-label="Name" className="user-card-header">
                    <span className="user-cell">
                      <span className="avatar-circle">{initials(u.name)}</span>
                      <span>
                        <div style={{ fontWeight: 700 }}>
                          {u.name}
                          {u.id === me.id && <span className="muted"> (you)</span>}
                          {u.status === 'rejected' && (
                            <span className="badge badge-rejected" style={{ marginLeft: 8 }}>
                              Rejected
                            </span>
                          )}
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{u.email}</div>
                      </span>
                    </span>
                    <div className="user-card-header-right">
                      <div>{u.phone || '—'}</div>
                      <div className="muted mono" style={{ fontSize: 12, marginTop: 4 }}>{fmtDate(u.createdAt)}</div>
                    </div>
                  </td>
                  <td data-label="KYC Status">
                    {u.role === 'admin' ? (
                      <span className="muted">—</span>
                    ) : (
                      <span
                        className={
                          'badge ' +
                          (u.kycStatus === 'verify'
                            ? 'badge-kyc-verify'
                            : u.kycStatus === 'rejected'
                            ? 'badge-kyc-rejected'
                            : 'badge-kyc-unverify')
                        }
                      >
                        {u.kycStatus === 'verify' ? 'Verify' : u.kycStatus === 'rejected' ? 'Rejected' : 'Unverify'}
                      </span>
                    )}
                  </td>
                  <td data-label="Mood">
                    <span className={'badge ' + (u.profitMode ? 'badge-trade-on' : 'badge-trade-off')}>
                      {u.profitMode ? 'Profit' : 'Loss'}
                    </span>
                  </td>
                  <td className="right actions-cell">
                    <IconButton
                      icon="holdings"
                      active={openFor === u.id}
                      title={openFor === u.id ? 'Close holdings' : 'Manage holdings'}
                      aria-label={openFor === u.id ? 'Close holdings' : 'Manage holdings'}
                      onClick={() => {
                        setDocsFor(null)
                        setOpenFor(openFor === u.id ? null : u.id)
                      }}
                    />
                    {u.role !== 'admin' && (
                      <IconButton
                        icon="docs"
                        active={docsFor === u.id}
                        title={docsFor === u.id ? 'Hide documents' : 'Documents'}
                        aria-label={docsFor === u.id ? 'Hide documents' : 'Documents'}
                        onClick={() => {
                          setOpenFor(null)
                          setDocsFor(docsFor === u.id ? null : u.id)
                        }}
                      />
                    )}
                    {u.id !== me.id && (
                      <>
                        <IconButton
                          icon="login"
                          title="Login as user"
                          aria-label="Login as user"
                          onClick={() => loginAs(u)}
                        />
                        <IconButton
                          icon="trash"
                          danger
                          title="Delete"
                          aria-label="Delete"
                          onClick={() => setDeleteTarget(u)}
                        />
                      </>
                    )}
                  </td>
                </tr>
                {docsFor === u.id && (
                  <tr>
                    <td colSpan={4} className="no-stack" style={{ padding: 0, borderTop: 'none' }}>
                      <div className="panel panel-pad holdings-panel-wrap" style={{ margin: '0 0 16px' }}>
                        <KycPanel
                          userId={u.id}
                          user={u}
                          busy={updatingStatus[u.id]}
                          onChangeStatus={(status) => changeUserKycStatus(u, status)}
                        />
                      </div>
                    </td>
                  </tr>
                )}
                {openFor === u.id && (
                  <tr>
                    <td colSpan={4} className="no-stack" style={{ padding: 0, borderTop: 'none' }}>
                      <div className="panel panel-pad holdings-panel-wrap" style={{ margin: '0 0 16px' }}>
                        <ManageHoldingsPanel
                          user={u}
                          coins={coins}
                          onModeChanged={(message) => {
                            refresh()
                            setStatusMessage(message)
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {deleteTarget && (
        <div className="popup-overlay">
          <div className="popup-panel">
            <p>Delete {deleteTarget.name}? This also clears their portfolio.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
              <button type="button" className="btn btn-sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </button>
              <button type="button" className="btn btn-sm btn-danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Confirm delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
