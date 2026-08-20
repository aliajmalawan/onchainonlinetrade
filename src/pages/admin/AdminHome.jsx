import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGetUsers } from '../../lib/backend'
import StatCard from '../../components/StatCard'

export default function AdminHome() {
  const [users, setUsers] = useState([])

  useEffect(() => {
    apiGetUsers().then(setUsers).catch(() => setUsers([]))
  }, [])

  const admins = users.filter((u) => u.role === 'admin').length
  const newest = useMemo(
    () => [...users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0],
    [users]
  )
  const totalHoldings = users.reduce((sum, u) => sum + (u.holdingsCount || 0), 0)

  return (
    <div>
      <div className="page-head">
        <p>Platform-level stats. Admins manage accounts and roles — nothing about market data or balances is faked here.</p>
      </div>

      <div className="stat-grid overview-stat-grid">
        <StatCard label="TOTAL USERS" value={String(users.length)} />
        <StatCard label="ADMINS" value={String(admins)} />
        <StatCard label="STANDARD USERS" value={String(users.length - admins)} />
        <StatCard label="HOLDINGS" value={String(totalHoldings)} />
        <StatCard label="NEWEST SIGN-UP" value={newest ? newest.name : '—'} />
      </div>

      <div className="panel panel-pad mt-24">
        <div className="spread">
          <div>
            <h2 style={{ fontSize: 16 }}>Manage accounts</h2>
            <p className="muted mb-0" style={{ marginTop: 4 }}>
              Promote or remove users from the Users page.
            </p>
          </div>
          <Link to="/admin/users" className="btn">
            Open Users →
          </Link>
        </div>
      </div>
    </div>
  )
}
