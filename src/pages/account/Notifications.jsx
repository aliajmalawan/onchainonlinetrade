import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { apiGetTradeHistory, apiGetWithdrawHistory, apiGetNotifications } from '../../lib/backend'
import { num } from '../../lib/format'

const ACTION_LABEL = { add: 'Bought', update: 'Updated', remove: 'Sold' }

const TYPE_BADGE = {
  Bought: 'badge-action-add',
  Sold: 'badge-action-remove',
  Updated: 'badge-action-update',
}

const STATUS_BADGE = {
  Completed: 'badge-wd-completed',
  Verified: 'badge-wd-completed',
  Read: 'badge-user',
  Pending: 'badge-wd-pending',
  Unread: 'badge-wd-pending',
  Rejected: 'badge-wd-rejected',
  'Action required': 'badge-wd-rejected',
}

// Short "Aug 13, 2026 · 15:42" style stamp used on the history card.
const fmtCardDate = (t) => {
  const d = new Date(t)
  const date = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${date} · ${time}`
}

function NotificationCard({ item }) {
  return (
    <div className="history-card">
      <div className="history-card-top">
        <div className="history-card-icon-group">
          <span className={'badge ' + (TYPE_BADGE[item.type] || 'badge-user')}>{item.type}</span>
        </div>
        <span className={'badge ' + (STATUS_BADGE[item.status] || 'badge-user')}>{item.status}</span>
      </div>
      <div className="notification-card-details">{item.details}</div>
      <div className="history-card-bottom">
        <div className="history-card-meta">{fmtCardDate(item.date)}</div>
      </div>
    </div>
  )
}

export default function Notifications() {
  const { user } = useAuth()
  const [trades, setTrades] = useState(null)
  const [withdraws, setWithdraws] = useState(null)
  const [notifications, setNotifications] = useState(null)

  useEffect(() => {
    apiGetTradeHistory().then(setTrades).catch(() => setTrades([]))
    apiGetWithdrawHistory().then(setWithdraws).catch(() => setWithdraws([]))
    apiGetNotifications().then(setNotifications).catch(() => setNotifications([]))
  }, [])

  const items = useMemo(() => {
    const tradeItems = (trades ?? []).map((trade) => ({
      id: `trade-${trade.id}`,
      date: trade.createdAt,
      type: ACTION_LABEL[trade.action] || trade.action,
      details: `${trade.amount} ${trade.symbol.toUpperCase()} @ $${trade.price.toFixed(2)}`,
      status: 'Completed',
    }))

    const withdrawItems = (withdraws ?? []).map((withdraw) => ({
      id: `withdraw-${withdraw.id}`,
      date: withdraw.createdAt,
      type: 'Withdrawal',
      details: `${num(withdraw.amount)} ${withdraw.currency} to ${withdraw.address || 'unknown address'}`,
      status: withdraw.status === 'pending' ? 'Pending' : withdraw.status === 'completed' ? 'Completed' : 'Rejected',
    }))

    const accountItems = []
    if (user) {
      if (user.kycStatus === 'rejected') {
        accountItems.push({
          id: 'account-kyc-rejected',
          date: user.createdAt || new Date().toISOString(),
          type: 'Account',
          details: 'Your identity verification has been rejected. Please resubmit documents or contact support.',
          status: 'Action required',
        })
      } else if (user.kycStatus === 'verify') {
        accountItems.push({
          id: 'account-kyc-verified',
          date: user.verifiedAt || user.updatedAt || user.createdAt || new Date().toISOString(),
          type: 'Account',
          details: `Your account is KYC verified for ${user.email}.`,
          status: 'Verified',
        })
      } else {
        accountItems.push({
          id: 'account-kyc',
          date: user.createdAt || new Date().toISOString(),
          type: 'Account',
          details: 'Identity verification is pending. Complete KYC to unlock full account access.',
          status: 'Action required',
        })
      }
    }

    const serverItems = (notifications ?? []).map((n) => ({
      id: `notif-${n.id}`,
      date: n.createdAt,
      type: 'Alert',
      details: n.message,
      status: n.isRead ? 'Read' : 'Unread',
    }))

    return [...accountItems, ...serverItems, ...withdrawItems, ...tradeItems].sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [trades, withdraws, user, notifications])

  const loading = trades === null || withdraws === null

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Account</div>
        <h1>Notifications</h1>
        <p>Review account, withdrawal, and trade updates in one place.</p>
      </div>

      <div className="history-cards">
        {loading && <div className="muted">Loading…</div>}
        {!loading && items.length === 0 && <div className="empty">No notifications yet.</div>}
        {items.map((item) => (
          <NotificationCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}
