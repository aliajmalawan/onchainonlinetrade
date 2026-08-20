import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ICON_PATHS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  wallet: (
    <>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </>
  ),
  analytics: (
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>
  ),
  markets: (
    <>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </>
  ),
  trade: (
    <>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
}

function NavIcon({ name }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_PATHS[name]}
    </svg>
  )
}

function Item({ to, label, icon }) {
  return (
    <NavLink to={to} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} end>
      <span className="nav-icon-badge">
        <NavIcon name={icon} />
      </span>
      <span className="nav-label">{label}</span>
    </NavLink>
  )
}

// Fixed bottom tab bar shown on every authenticated page — the app's only
// navigation surface at any screen size.
export default function Sidebar() {
  const { isAdmin } = useAuth()

  return (
    <aside className="sidebar">
      <nav>
        <div className="nav-mobile-list">
          <Item to="/dashboard" label="Dashboard" icon="dashboard" />
          <Item to="/trade" label="Trade" icon="trade" />
          {isAdmin && <Item to="/admin/analytics" label="Analytics" icon="analytics" />}
          <Item to="/markets" label="Markets" icon="markets" />
          <Item to="/wallet" label="Wallet" icon="wallet" />
          {isAdmin && <Item to="/admin/users" label="Users" icon="users" />}
        </div>
      </nav>
    </aside>
  )
}
