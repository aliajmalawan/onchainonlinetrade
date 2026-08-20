import { useEffect, useMemo, useState } from 'react'
import { apiGetUsers, apiAdminGetWithdrawRequests } from '../../lib/backend'
import StatCard from '../../components/StatCard'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

// Validated (CVD-safe) status triad — see dataviz skill: green↔red adjacency
// fails deuteranopia/protanopia separation, so "good" uses blue instead.
const STATUS_COLOR = {
  pending: '#c98500',
  unverify: '#c98500',
  completed: '#3987e5',
  verify: '#3987e5',
  rejected: '#d03b3b',
  failed: '#d03b3b',
}
const TEAL = '#0f9c8f'

const axisTick = { fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono' }
const tooltipStyle = {
  contentStyle: {
    background: '#ffffff',
    border: '1px solid #e3e7f0',
    borderRadius: 8,
    fontFamily: 'JetBrains Mono',
    fontSize: 12,
  },
  labelStyle: { color: '#64748b' },
}

function lastNDaysSeries(items, days, dateField) {
  const buckets = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    buckets.push({ key: d.toISOString().slice(0, 10), count: 0 })
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  items.forEach((item) => {
    const key = new Date(item[dateField]).toISOString().slice(0, 10)
    const bucket = byKey.get(key)
    if (bucket) bucket.count += 1
  })
  return buckets.map((b) => ({ date: b.key, count: b.count }))
}

const fmtTick = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function ChartPanel({ title, subtitle, children }) {
  return (
    <div className="panel panel-pad">
      <h3 style={{ fontSize: 14, marginBottom: 2 }}>{title}</h3>
      {subtitle && (
        <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
          {subtitle}
        </div>
      )}
      <ResponsiveContainer width="100%" height={240}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export default function Analytics() {
  const [users, setUsers] = useState(null)
  const [withdraws, setWithdraws] = useState(null)

  useEffect(() => {
    apiGetUsers().then(setUsers).catch(() => setUsers([]))
    apiAdminGetWithdrawRequests().then(setWithdraws).catch(() => setWithdraws([]))
  }, [])

  const nonAdminUsers = useMemo(() => (users ?? []).filter((u) => u.role !== 'admin'), [users])
  const totalHoldings = useMemo(() => (users ?? []).reduce((sum, u) => sum + (u.holdingsCount || 0), 0), [users])

  const kycData = useMemo(() => {
    const counts = { unverify: 0, verify: 0, rejected: 0 }
    nonAdminUsers.forEach((u) => {
      const key = counts[u.kycStatus] !== undefined ? u.kycStatus : 'unverify'
      counts[key] += 1
    })
    return [
      { name: 'Unverify', value: counts.unverify, fill: STATUS_COLOR.unverify },
      { name: 'Verify', value: counts.verify, fill: STATUS_COLOR.verify },
      { name: 'Rejected', value: counts.rejected, fill: STATUS_COLOR.rejected },
    ]
  }, [nonAdminUsers])

  const withdrawStatusData = useMemo(() => {
    const counts = { pending: 0, completed: 0, failed: 0 }
    ;(withdraws ?? []).forEach((w) => {
      const key = counts[w.status] !== undefined ? w.status : 'pending'
      counts[key] += 1
    })
    return [
      { name: 'Pending', value: counts.pending, fill: STATUS_COLOR.pending },
      { name: 'Completed', value: counts.completed, fill: STATUS_COLOR.completed },
      { name: 'Rejected', value: counts.failed, fill: STATUS_COLOR.rejected },
    ]
  }, [withdraws])

  const signupSeries = useMemo(() => lastNDaysSeries(nonAdminUsers, 30, 'createdAt'), [nonAdminUsers])
  const withdrawSeries = useMemo(() => lastNDaysSeries(withdraws ?? [], 30, 'createdAt'), [withdraws])

  const loading = users === null || withdraws === null
  const pendingCount = (withdraws ?? []).filter((w) => w.status === 'pending').length

  const labelStyle = { fill: '#64748b', fontSize: 12, fontFamily: 'JetBrains Mono' }

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Admin</div>
        <h1>Analytics</h1>
        <p>Platform activity at a glance — user growth, KYC status, and withdrawal trends.</p>
      </div>

      <div className="stat-grid analytics-stat-grid">
        <StatCard label="TOTAL USERS" value={loading ? '—' : String(nonAdminUsers.length)} />
        <StatCard label="TOTAL HOLDINGS" value={loading ? '—' : String(totalHoldings)} />
        <StatCard label="WITHDRAWAL REQUESTS" value={loading ? '—' : String((withdraws ?? []).length)} />
        <StatCard label="PENDING WITHDRAWALS" value={loading ? '—' : String(pendingCount)} />
      </div>

      <div className="analytics-grid">
        <ChartPanel title="New users" subtitle="Signups per day, last 30 days">
          <AreaChart data={signupSeries} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TEAL} stopOpacity={0.28} />
                <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e3e7f0" vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtTick} tick={axisTick} stroke="#e3e7f0" minTickGap={40} />
            <YAxis allowDecimals={false} tick={axisTick} stroke="#e3e7f0" width={32} />
            <Tooltip
              {...tooltipStyle}
              labelFormatter={fmtTick}
              formatter={(v) => [v, 'New users']}
            />
            <Area type="monotone" dataKey="count" stroke={TEAL} strokeWidth={2} fill="url(#signupFill)" />
          </AreaChart>
        </ChartPanel>

        <ChartPanel title="Withdrawal requests" subtitle="Requests submitted per day, last 30 days">
          <AreaChart data={withdrawSeries} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="withdrawFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TEAL} stopOpacity={0.28} />
                <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e3e7f0" vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtTick} tick={axisTick} stroke="#e3e7f0" minTickGap={40} />
            <YAxis allowDecimals={false} tick={axisTick} stroke="#e3e7f0" width={32} />
            <Tooltip
              {...tooltipStyle}
              labelFormatter={fmtTick}
              formatter={(v) => [v, 'Requests']}
            />
            <Area type="monotone" dataKey="count" stroke={TEAL} strokeWidth={2} fill="url(#withdrawFill)" />
          </AreaChart>
        </ChartPanel>

        <ChartPanel title="KYC status" subtitle="Users by identity-verification state">
          <BarChart data={kycData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e3e7f0" vertical={false} />
            <XAxis dataKey="name" tick={axisTick} stroke="#e3e7f0" />
            <YAxis allowDecimals={false} tick={axisTick} stroke="#e3e7f0" width={32} />
            <Tooltip {...tooltipStyle} formatter={(v) => [v, 'Users']} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={64}>
              {kycData.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
              <LabelList dataKey="value" position="top" style={labelStyle} />
            </Bar>
          </BarChart>
        </ChartPanel>

        <ChartPanel title="Withdrawal status" subtitle="Requests by current status">
          <BarChart data={withdrawStatusData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e3e7f0" vertical={false} />
            <XAxis dataKey="name" tick={axisTick} stroke="#e3e7f0" />
            <YAxis allowDecimals={false} tick={axisTick} stroke="#e3e7f0" width={32} />
            <Tooltip {...tooltipStyle} formatter={(v) => [v, 'Requests']} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={64}>
              {withdrawStatusData.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
              <LabelList dataKey="value" position="top" style={labelStyle} />
            </Bar>
          </BarChart>
        </ChartPanel>
      </div>
    </div>
  )
}
