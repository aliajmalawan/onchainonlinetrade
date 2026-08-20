import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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

  const items = user?.role === 'admin' ? ADMIN_ITEMS : ITEMS

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
      <button className="btn btn-sm profile-menu-trigger" onClick={() => setOpen((v) => !v)} aria-label="Open profile menu">
        <span className="avatar-circle profile-menu-avatar" aria-hidden="true">☰</span>
        <span className="profile-menu-name">{user?.name?.split(' ')[0] || 'Profile'}</span>
      </button>
      {open && (
        <div className="profile-dropdown">
          {items.map((item) => (
            <div key={item.to}>
              <button className="profile-dropdown-item" onClick={() => go(item.to)}>
                <span>{item.label}</span>
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
