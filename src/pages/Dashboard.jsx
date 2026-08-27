import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMarkets, getBinance24hrTickers } from '../lib/api'
import {
  apiGetPortfolio,
  apiGetUsers,
  apiAdminGetDepositRequests,
  apiAdminGetWithdrawRequests,
  apiAdminGetDepositAddresses,
} from '../lib/backend'
import StatCard from '../components/StatCard'
import CoinTickerList from '../components/CoinTickerList'
import { usd, pct, changeClass } from '../lib/format'

function DepositIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7" />
      <polyline points="7 11 12 16 17 11" />
      <line x1="12" y1="16" x2="12" y2="3" />
    </svg>
  )
}

function WithdrawIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1" />
      <path d="M21 12h-4a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  )
}

function ConvertIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function MarketsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

function UsersStatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function DepositStatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7" />
      <polyline points="7 11 12 16 17 11" />
      <line x1="12" y1="16" x2="12" y2="3" />
    </svg>
  )
}

function ClockStatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function WalletStatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  )
}

const COIN_TABS = [
  { key: 'popular', label: 'Popular Coins' },
  { key: 'gainers', label: 'Top Gainers' },
  { key: 'losers', label: 'Top Losers' },
]

export default function Dashboard() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [coins, setCoins] = useState([])
  const [status, setStatus] = useState('loading')
  const [holdings, setHoldings] = useState([])
  const [totalUsers, setTotalUsers] = useState(null)
  const [depositCount, setDepositCount] = useState(null)
  const [pendingCount, setPendingCount] = useState(null)
  const [walletCount, setWalletCount] = useState(null)
  const [coinTab, setCoinTab] = useState('popular')

  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    let alive = true
    setStatus((s) => (s === 'ready' ? s : 'loading'))
    getMarkets({ perPage: 50 })
      .then((data) => {
        if (!alive) return
        setCoins(data)
        setStatus('ready')
      })
      .catch(() => {
        if (!alive) return
        setStatus('error')
      })
    return () => {
      alive = false
    }
  }, [retryTick])

  // A rate-limit or network blip is usually gone a few seconds later —
  // retry once on its own before leaving it to the manual "Try again" button.
  useEffect(() => {
    if (status !== 'error' || retryTick > 0) return
    const id = setTimeout(() => setRetryTick((n) => n + 1), 4000)
    return () => clearTimeout(id)
  }, [status, retryTick])

  useEffect(() => {
    apiGetPortfolio().then(setHoldings).catch(() => setHoldings([]))
  }, [user.id])

  useEffect(() => {
    if (!isAdmin) return
    apiGetUsers()
      .then((rows) => setTotalUsers(rows.filter((u) => u.role !== 'admin').length))
      .catch(() => setTotalUsers(0))
    apiAdminGetDepositRequests()
      .then((rows) => setDepositCount(rows.length))
      .catch(() => setDepositCount(0))
    apiAdminGetWithdrawRequests()
      .then((rows) => setPendingCount(rows.filter((w) => w.status === 'pending').length))
      .catch(() => setPendingCount(0))
    apiAdminGetDepositAddresses()
      .then((rows) => setWalletCount(rows.length))
      .catch(() => setWalletCount(0))
  }, [isAdmin])

  // Value the portfolio against live prices.
  const priceById = useMemo(() => {
    const map = {}
    coins.forEach((c) => (map[c.id] = c))
    return map
  }, [coins])

  const totals = useMemo(() => {
    let value = 0
    let cost = 0
    holdings.forEach((h) => {
      const live = priceById[h.coinId]?.current_price
      if (live != null) value += live * h.amount
      cost += h.buyPrice * h.amount
    })
    const pnl = value - cost
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
    return { value, cost, pnl, pnlPct }
  }, [holdings, priceById])

  const topMovers = useMemo(
    () =>
      [...coins]
        .sort(
          (a, b) =>
            Math.abs(b.price_change_percentage_24h || 0) -
            Math.abs(a.price_change_percentage_24h || 0)
        )
        .slice(0, 5),
    [coins]
  )

  const tabCoins = useMemo(() => {
    if (coinTab === 'gainers') {
      return [...coins].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)).slice(0, 10)
    }
    if (coinTab === 'losers') {
      return [...coins].sort((a, b) => (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0)).slice(0, 10)
    }
    return coins.slice(0, 10)
  }, [coins, coinTab])

  // Whichever coin list this dashboard is actually showing — CoinGecko's
  // own snapshot barely moves within a few seconds, so a live Binance poll
  // (below) pushes fresher price/24h stats into these same rows.
  const visibleCoins = isAdmin ? topMovers : tabCoins

  const [liveMap, setLiveMap] = useState({})
  const [flashMap, setFlashMap] = useState({})
  const prevPricesRef = useRef({})
  const flashTimersRef = useRef({})

  useEffect(() => {
    const symbols = visibleCoins.map((c) => c.symbol?.toUpperCase()).filter(Boolean)
    if (!symbols.length) return

    let cancelled = false
    function poll() {
      getBinance24hrTickers(symbols)
        .then((data) => {
          if (cancelled) return
          setLiveMap((prev) => ({ ...prev, ...data }))

          Object.entries(data).forEach(([symbol, live]) => {
            const prevPrice = prevPricesRef.current[symbol]
            if (prevPrice != null && live.price !== prevPrice) {
              const direction = live.price > prevPrice ? 'up' : 'down'
              setFlashMap((prev) => ({ ...prev, [symbol]: direction }))
              clearTimeout(flashTimersRef.current[symbol])
              flashTimersRef.current[symbol] = setTimeout(() => {
                setFlashMap((prev) => ({ ...prev, [symbol]: null }))
              }, 550)
            }
            prevPricesRef.current[symbol] = live.price
          })
        })
        .catch(() => {
          // Binance rejects the whole batch if any symbol has no USDT
          // market (common for small-cap gainers/losers) — just stay on
          // CoinGecko's own values for this poll rather than breaking the list.
        })
    }
    poll()
    const id = setInterval(poll, 3000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCoins.map((c) => c.id).join(',')])

  useEffect(() => () => Object.values(flashTimersRef.current).forEach(clearTimeout), [])

  const liveVisibleCoins = useMemo(
    () =>
      visibleCoins.map((c) => {
        const live = liveMap[c.symbol?.toUpperCase()]
        return {
          ...c,
          current_price: live?.price ?? c.current_price,
          price_change_percentage_24h: live?.changePct ?? c.price_change_percentage_24h,
          total_volume: live?.volume ?? c.total_volume,
          high_24h: live?.high ?? c.high_24h,
          flash: flashMap[c.symbol?.toUpperCase()] || null,
        }
      }),
    [visibleCoins, liveMap, flashMap]
  )

  if (isAdmin) {
    return (
      <div>
        <div className="page-head">
          <p>Platform activity at a glance.</p>
        </div>

        <div className="stat-grid admin-stat-grid">
          <StatCard
            label="TOTAL USERS"
            value={totalUsers === null ? '—' : String(totalUsers)}
            to="/admin/users"
            icon={<UsersStatIcon />}
            accent="blue"
          />
          <StatCard
            label="DEPOSIT REQUESTS"
            value={depositCount === null ? '—' : String(depositCount)}
            to="/admin/deposits"
            icon={<DepositStatIcon />}
            accent="teal"
          />
          <StatCard
            label="PENDING REQUESTS"
            value={pendingCount === null ? '—' : String(pendingCount)}
            to="/admin/withdrawals"
            icon={<ClockStatIcon />}
            accent="amber"
          />
          <StatCard
            label="MANAGE WALLETS"
            value={walletCount === null ? '—' : String(walletCount)}
            to="/admin/wallets"
            icon={<WalletStatIcon />}
            accent="purple"
          />
        </div>

        <div className="spread mt-24" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 18 }}>Top movers (24h)</h2>
          <Link to="/markets" className="muted">
            All markets →
          </Link>
        </div>

        {status === 'loading' && <div className="loading">Loading market data…</div>}
        {status === 'error' && (
          <div className="alert alert-error spread">
            <span>Couldn’t load market data. Try again shortly.</span>
            <button className="btn btn-sm" onClick={() => setRetryTick((n) => n + 1)}>
              Try again
            </button>
          </div>
        )}
        {status === 'ready' && <CoinTickerList coins={liveVisibleCoins} />}
      </div>
    )
  }

  return (
    <div>
      <div className="panel panel-pad wallet-summary-card">
        <div className="home-wallet-card-top">
          <div>
            <div className="muted" style={{ fontSize: 13 }}>Est. Total Value (USD)</div>
            <div className="wallet-total-value">{usd(totals.value)}</div>
          </div>
          <button type="button" className="home-add-funds-btn" onClick={() => navigate('/wallet')}>
            Add Funds
          </button>
        </div>
        <div className="home-pnl-row">
          <span className="muted">Today PNL</span>
          <span className={changeClass(totals.pnl)}>
            {usd(totals.pnl)} ({pct(totals.pnlPct)})
          </span>
        </div>
      </div>

      <div className="home-action-row">
        <Link to="/account/deposit" className="wallet-action-btn">
          <span className="wallet-action-icon wallet-action-icon-deposit"><DepositIcon /></span>
          <span>Deposit</span>
        </Link>
        <Link to="/account/withdraw" className="wallet-action-btn">
          <span className="wallet-action-icon wallet-action-icon-withdraw"><WithdrawIcon /></span>
          <span>Withdraw</span>
        </Link>
        <Link to="/convert" className="wallet-action-btn">
          <span className="wallet-action-icon wallet-action-icon-convert"><ConvertIcon /></span>
          <span>Convert</span>
        </Link>
        <Link to="/markets" className="wallet-action-btn">
          <span className="wallet-action-icon wallet-action-icon-markets"><MarketsIcon /></span>
          <span>Markets</span>
        </Link>
      </div>

      <div className="coin-tabs">
        {COIN_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={'coin-tab' + (coinTab === t.key ? ' active' : '')}
            onClick={() => setCoinTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {status === 'loading' && <div className="loading">Loading market data…</div>}
      {status === 'error' && (
        <div className="alert alert-error spread mt-24">
          <span>Couldn’t load market data. Try again shortly.</span>
          <button className="btn btn-sm" onClick={() => setRetryTick((n) => n + 1)}>
            Try again
          </button>
        </div>
      )}
      {status === 'ready' && (
        <div className="mt-24">
          <CoinTickerList coins={liveVisibleCoins} />
        </div>
      )}
    </div>
  )
}
