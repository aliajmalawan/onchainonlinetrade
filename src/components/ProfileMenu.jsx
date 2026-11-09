import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiAdminGetMenuCounts, apiAdminMarkMenuSeen, apiGetSupportUnread } from '../lib/backend'

const MENU_COUNTS_POLL_MS = 10000

// Admin page -> the badge section that opening it marks as seen.
const PAGE_SECTIONS = {
  '/admin/deposits': 'deposits',
  '/admin/withdrawals': 'withdrawals',
  '/admin/chat': 'chat',
}
const SECTION_COUNT_KEY = {
  deposits: 'pendingDeposits',
  withdrawals: 'pendingWithdrawals',
  chat: 'chatUsers',
}

const badgeText = (n) => (n > 99 ? '99+' : String(n))

const ITEMS = [
  { to: '/account/password', label: 'Update password' },
  { to: '/account/profile', label: 'Update account' },
  { to: '/account/kyc', label: 'Identity verification (KYC)' },
  { to: '/support', label: 'Customer Support' },
  { to: '/account/deposits', label: 'Deposit history' },
  { to: '/account/withdrawals', label: 'Withdraw history' },
  { to: '/account/history', label: 'Trade history' },
]

// The mobile bottom bar only has room for Dashboard/Analytics/Markets/Trade/
// Users — these admin destinations live in the profile menu instead.
const ADMIN_ITEMS = [
  { to: '/account/profile', label: 'Profile' },
  { to: '/account/password', label: 'Update Password' },
  { to: '/admin/overview', label: 'Overview' },
  { to: '/admin/wallets', label: 'Manage Wallets' },
  { to: '/admin/deposits', label: 'Deposit Requests' },
  { to: '/admin/withdrawals', label: 'Withdrawals' },
  { to: '/admin/chat', label: 'Live Chat' },
]

export default function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const { user, logout } = useAuth()
  const { refreshUser } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isAdmin = user?.role === 'admin'
  const [counts, setCounts] = useState({ chatUsers: 0, pendingDeposits: 0, pendingWithdrawals: 0 })
  const [supportUnread, setSupportUnread] = useState(0) // customer: unseen support replies

  // Admin: keep the menu badges current. Being on a badge's page counts as
  // having seen it — that section is marked seen (and its badge hidden) on
  // arrival and on every poll while the admin stays there, so only what
  // arrives after they leave shows up again.
  useEffect(() => {
    if (!isAdmin) return
    let mounted = true
    const section = PAGE_SECTIONS[pathname]
    const load = async () => {
      try {
        if (section) await apiAdminMarkMenuSeen(section)
        const c = await apiAdminGetMenuCounts()
        if (mounted) setCounts(c)
      } catch {
        // keep the last known counts
      }
    }
    if (section) setCounts((c) => ({ ...c, [SECTION_COUNT_KEY[section]]: 0 }))
    load()
    const id = setInterval(load, MENU_COUNTS_POLL_MS)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [isAdmin, pathname])

  // Customer: badge the Customer Support item with support replies they
  // haven't seen. The chat page itself marks them seen, so while it is open
  // the badge stays hidden and isn't polled.
  useEffect(() => {
    if (!user || isAdmin) return
    if (pathname === '/support') {
      setSupportUnread(0)
      return
    }
    let mounted = true
    const load = () =>
      apiGetSupportUnread()
        .then((n) => mounted && setSupportUnread(n))
        .catch(() => {})
    load()
    const id = setInterval(load, MENU_COUNTS_POLL_MS)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [user, isAdmin, pathname])

  useEffect(() => {
    if (!open) return
    function onClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    function onEscape(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    // refresh user when opening the menu so badges (like KYC) stay up-to-date
    if (refreshUser) refreshUser().catch(() => {})
  }, [open, refreshUser])

  // Manage Profits is listed only for the admins allowed to use it.
  const items = isAdmin
    ? user?.canManageProfits
      ? [...ADMIN_ITEMS, { to: '/admin/profits', label: 'Manage Profits' }]
      : ADMIN_ITEMS
    : ITEMS

  // Menu item -> { count, title } for its red badge.
  const badges = isAdmin
    ? {
        '/admin/deposits': {
          count: counts.pendingDeposits,
          title: `${counts.pendingDeposits} pending deposit ${counts.pendingDeposits === 1 ? 'request' : 'requests'}`,
        },
        '/admin/withdrawals': {
          count: counts.pendingWithdrawals,
          title: `${counts.pendingWithdrawals} pending withdrawal ${counts.pendingWithdrawals === 1 ? 'request' : 'requests'}`,
        },
        '/admin/chat': {
          count: counts.chatUsers,
          title: `${counts.chatUsers} ${counts.chatUsers === 1 ? 'user has' : 'users have'} sent new messages`,
        },
      }
    : {
        '/support': {
          count: supportUnread,
          title: `${supportUnread} new ${supportUnread === 1 ? 'message' : 'messages'} from Support`,
        },
      }
  const totalBadge = Object.values(badges).reduce((sum, b) => sum + b.count, 0)
  const totalBadgeTitle = Object.values(badges)
    .filter((b) => b.count > 0)
    .map((b) => b.title)
    .join(', ')

  function go(to) {
    setOpen(false)
    navigate(to)
  }

  async function handleLogout() {
    setOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <div className="profile-menu" ref={rootRef}>
      <button
        className="btn btn-sm profile-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={totalBadge > 0 ? `Open profile menu, ${totalBadgeTitle}` : 'Open profile menu'}
      >
        <span className="avatar-circle profile-menu-avatar" aria-hidden="true">☰</span>
        <span className="profile-menu-name">{user?.name?.split(' ')[0] || 'Profile'}</span>
        {totalBadge > 0 && (
          <span className="menu-count-badge menu-trigger-badge" aria-hidden="true">{badgeText(totalBadge)}</span>
        )}
      </button>
      {open && (
        <div className="profile-dropdown">
          {items.map((item) => (
            <div key={item.to}>
              <button className="profile-dropdown-item" onClick={() => go(item.to)}>
                <span>{item.label}</span>
                {badges[item.to]?.count > 0 && (
                  <span className="menu-count-badge" title={badges[item.to].title}>
                    {badgeText(badges[item.to].count)}
                  </span>
                )}
                {item.to === '/account/kyc' && (
                  <span
                    className="kyc-badge"
                    title={
                      user?.kycStatus === 'rejected'
                        ? 'Identity verification rejected'
                        : user?.kycStatus === 'verify'
                        ? 'Verified'
                        : 'Identity verification required'
                    }
                  >
                    <span
                      className={
                        'kyc-pill ' +
                        (user?.kycStatus === 'rejected'
                          ? 'kyc-rejected'
                          : user?.kycStatus === 'verify'
                          ? 'kyc-verify'
                          : 'kyc-unverify')
                      }
                      aria-hidden="true"
                    >
                      {user?.kycStatus === 'rejected' ? '✕' : user?.kycStatus === 'verify' ? '✓' : '!'}
                    </span>
                  </span>
                )}
              </button>
            </div>
          ))}
          <div className="profile-dropdown-divider" />
          <button className="profile-dropdown-item profile-dropdown-danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
