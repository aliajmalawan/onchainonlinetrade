import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  apiGetTradeHistory,
  apiGetWithdrawHistory,
  apiGetNotifications,
  apiAdminGetWithdrawRequests,
  apiMarkNotificationRead,
} from '../lib/backend'
import { num } from '../lib/format'
import ProfileMenu from './ProfileMenu'

// Persistent header shown above the content on every authenticated page.
export default function Topbar() {
  const { user, isAdmin, refreshUser, impersonating, returnToAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const [trades, setTrades] = useState(null)
  const [withdraws, setWithdraws] = useState(null)
  const [notifications, setNotifications] = useState(null)
  const [seenNotifIds, setSeenNotifIds] = useState(() => new Set())
  const [loadingTrades, setLoadingTrades] = useState(true)
  const [loadingWithdraws, setLoadingWithdraws] = useState(true)
  const [adminWithdrawRequests, setAdminWithdrawRequests] = useState(null)
  const [lastReadAt, setLastReadAt] = useState(0)
  const rootRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user?.id) return
    const saved = localStorage.getItem(`ct.notifLastReadAt.${user.id}`)
    setLastReadAt(saved ? parseInt(saved, 10) : 0)
  }, [user?.id])

  useEffect(() => {
    if (isAdmin) return
    apiGetTradeHistory()
      .then(setTrades)
      .catch(() => setTrades([]))
      .finally(() => setLoadingTrades(false))
  }, [isAdmin])

  useEffect(() => {
    if (isAdmin) return
    let mounted = true
    const POLL_MS = 5000

    async function load() {
      try {
        const rows = await apiGetNotifications()
        if (!mounted) return
        setNotifications(rows)

        // detect new KYC rejection notifications
        const newIds = new Set(seenNotifIds)
        let foundNewKycReject = false
        for (const n of rows || []) {
          newIds.add(n.id)
          if (!seenNotifIds.has(n.id) && n.type === 'kyc' && /reject/i.test(n.message)) {
            foundNewKycReject = true
          }
        }
        setSeenNotifIds(newIds)
        if (foundNewKycReject && refreshUser) {
          refreshUser().catch(() => {})
        }
      } catch (e) {
        if (mounted) setNotifications([])
      }
    }

    // initial load and periodic polling
    load()
    const id = setInterval(load, POLL_MS)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [isAdmin, user?.id, refreshUser, seenNotifIds])

  useEffect(() => {
    if (isAdmin) return
    apiGetWithdrawHistory()
      .then(setWithdraws)
      .catch(() => setWithdraws([]))
      .finally(() => setLoadingWithdraws(false))
  }, [isAdmin])

  // Admin: notification feed is just incoming withdrawal requests from users.
  useEffect(() => {
    if (!isAdmin) return
    let mounted = true
    const POLL_MS = 5000

    async function load() {
      try {
        const rows = await apiAdminGetWithdrawRequests()
        if (mounted) setAdminWithdrawRequests(rows)
      } catch {
        if (mounted) setAdminWithdrawRequests([])
      }
    }

    load()
    const id = setInterval(load, POLL_MS)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [isAdmin])

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

  const accountNotifications = []
  if (user && !isAdmin) {
    const accountTime = user.createdAt || new Date().toISOString()
    const accountDisplayTime = new Date(accountTime).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    if (user.kycStatus === 'rejected') {
      accountNotifications.push({
        id: 'kyc-rejected',
        label: 'Your identity verification has been rejected. Please resubmit documents or contact support.',
        time: accountTime,
        displayTime: accountDisplayTime,
        action: 'Review KYC',
        to: '/account/kyc',
      })
    } else if (user.kycStatus === 'verify') {
      accountNotifications.push({
        id: 'kyc-verified',
        label: `Your account is KYC verified for ${user.email}.`,
        time: accountTime,
        displayTime: accountDisplayTime,
        action: 'View profile',
        to: '/account/profile',
      })
    } else {
      accountNotifications.push({
        id: 'kyc',
        label: 'Identity verification is pending. Complete KYC to unlock full account access.',
        time: accountTime,
        displayTime: accountDisplayTime,
        action: 'Verify now',
        to: '/account/kyc',
      })
    }
  }

  // server-side notifications (like KYC rejected)
  const serverNotifications = (notifications ?? []).map((n) => ({
    id: `notif-${n.id}`,
    label: n.message,
    time: n.createdAt,
    displayTime: new Date(n.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    action: 'View',
    to: '/account/notifications',
  }))

  const sortedTrades = trades
    ? [...trades].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : []
  const tradeNotifications = sortedTrades.slice(0, 3).map((trade) => ({
    id: `trade-${trade.id}`,
    label: `${trade.action === 'remove' ? 'Sold' : trade.action === 'add' ? 'Bought' : 'Updated'} ${trade.amount} ${trade.symbol.toUpperCase()} @ $${trade.price.toFixed(2)}`,
    time: trade.createdAt,
    displayTime: new Date(trade.createdAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    action: 'View trade history',
    to: '/account/history',
  }))

  const withdrawNotifications = (withdraws ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3)
    .map((withdraw) => {
      const amount = num(withdraw.amount)
      const label =
        withdraw.status === 'pending'
          ? `Withdrawal request for ${amount} ${withdraw.currency} is pending.`
          : withdraw.status === 'completed'
          ? `Withdrawal of ${amount} ${withdraw.currency} completed.`
          : `Withdrawal request for ${amount} ${withdraw.currency} was rejected.`

      return {
        id: `withdraw-${withdraw.id}`,
        label,
        time: withdraw.createdAt,
        displayTime: new Date(withdraw.createdAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        action: 'View withdrawals',
        to: '/account/withdrawals',
      }
    })

  const adminWithdrawNotifications = (adminWithdrawRequests ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4)
    .map((w) => ({
      id: `admin-withdraw-${w.id}`,
      label: `${w.userName} requested a withdrawal of ${num(w.amount)} ${w.currency}.`,
      time: w.createdAt,
      displayTime: new Date(w.createdAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      action: 'Review request',
      to: '/admin/withdrawals',
    }))

  const allNotifications = isAdmin
    ? adminWithdrawNotifications
    : [...accountNotifications, ...serverNotifications, ...tradeNotifications, ...withdrawNotifications]
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, 4)

  const displayNotifications = allNotifications
  const loading = isAdmin ? adminWithdrawRequests === null : loadingTrades || loadingWithdraws
  const isUnread = (item) => new Date(item.time).getTime() > lastReadAt
  const unreadCount = isAdmin
    ? (adminWithdrawRequests ?? []).filter((w) => w.status === 'pending').length
    : [...accountNotifications, ...serverNotifications, ...tradeNotifications, ...withdrawNotifications].filter(isUnread).length

  function go(to) {
    setOpen(false)
    navigate(to)
  }

  async function handleReturnToAdmin() {
    await returnToAdmin()
    navigate('/admin/users')
  }

  function handleMarkAllRead() {
    const now = Date.now()
    setLastReadAt(now)
    if (user?.id) localStorage.setItem(`ct.notifLastReadAt.${user.id}`, String(now))
    ;(notifications ?? []).filter((n) => !n.isRead).forEach((n) => {
      apiMarkNotificationRead(n.id).catch(() => {})
    })
  }

  function handleBellClick() {
    setOpen((value) => !value)
  }

  return (
    <div className="topbar-wrap">
      <div className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <svg width="18" height="18" viewBox="0 0 32 32">
              <path
                d="M7 21 L13 13 L18 17 L25 8"
                fill="none"
                stroke="#2DD4BF"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="25" cy="8" r="2.5" fill="#F5B14C" />
            </svg>
          </span>
          <span className="brand-name">
            OnChain<span>Trade</span>
          </span>
        </div>

        <div className="topbar-actions">
          {impersonating && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleReturnToAdmin}
              title={`Viewing as ${user?.name}`}
            >
              ← Admin
            </button>
          )}
          <div className="notification-menu" ref={rootRef}>
            <button
              type="button"
              className="notification-button btn btn-sm"
              onClick={handleBellClick}
              aria-expanded={open}
              aria-label="Open notifications"
            >
              <span aria-hidden="true">🔔</span>
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>

            {open && (
              <div className="notification-dropdown">
                <div className="notification-dropdown-header">
                  <span>Notifications</span>
                  {unreadCount > 0 && <span className="notification-dropdown-count">{unreadCount} new</span>}
                </div>

                {!isAdmin && unreadCount > 0 && (
                  <button type="button" className="notification-mark-all" onClick={handleMarkAllRead}>
                    Mark all as read
                  </button>
                )}

                <div className="notification-dropdown-list">
                  {loading ? (
                    <div className="notification-empty">Loading notifications…</div>
                  ) : displayNotifications.length === 0 ? (
                    <div className="notification-empty">No notifications.</div>
                  ) : (
                    displayNotifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="notification-item"
                        onClick={() => go(item.to)}
                      >
                        <span className="notification-item-label">{item.label}</span>
                        {(item.action || item.displayTime) && (
                          <span className="notification-item-meta">
                            {item.action && <span className="notification-item-action">{item.action}</span>}
                            {item.displayTime && <span className="notification-item-time">{item.displayTime}</span>}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>

                <div className="notification-dropdown-footer">
                  {isAdmin ? (
                    <button type="button" className="notification-footer-link" onClick={() => go('/admin/withdrawals')}>
                      View all withdraw requests
                    </button>
                  ) : (
                    <>
                      <button type="button" className="notification-footer-link" onClick={() => go('/account/history')}>
                        View all trade history
                      </button>
                      <button type="button" className="notification-footer-link" onClick={() => go('/account/notifications')}>
                        View all notifications
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <ProfileMenu />
        </div>
      </div>
    </div>
  )
}
