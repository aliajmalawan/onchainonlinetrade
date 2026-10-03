import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMarkets } from '../lib/api'
import { apiGetPortfolio } from '../lib/backend'
import { usd, num } from '../lib/format'

function DepositIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7" />
      <polyline points="7 11 12 16 17 11" />
      <line x1="12" y1="16" x2="12" y2="3" />
    </svg>
  )
}

function WithdrawIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1" />
      <path d="M21 12h-4a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  )
}

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.46 18.46 0 0 1 4.22-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

export default function Wallet() {
  const [coins, setCoins] = useState([])
  const [holdings, setHoldings] = useState([])
  const [hideValue, setHideValue] = useState(false)

  useEffect(() => {
    getMarkets({ perPage: 100 }).then(setCoins).catch(() => {})
    apiGetPortfolio().then(setHoldings).catch(() => setHoldings([]))
  }, [])

  const priceById = useMemo(() => {
    const map = {}
    coins.forEach((c) => (map[c.id] = c))
    return map
  }, [coins])

  const rows = useMemo(
    () =>
      holdings.map((h) => {
        const live = priceById[h.coinId] ?? null
        return {
          ...h,
          value: live?.current_price != null ? live.current_price * h.amount : null,
          changePct: live?.price_change_percentage_24h ?? null,
        }
      }),
    [holdings, priceById]
  )

  const totalValue = rows.reduce((sum, r) => sum + (r.value || 0), 0)

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Account</div>
        <h1>Wallet</h1>
      </div>

      <div className="panel panel-pad wallet-summary-card">
        <div className="home-wallet-card-bg" aria-hidden="true">
          <div className="home-wallet-coin">₿</div>
        </div>
        <div className="home-wallet-card-content">
          <div className="home-wallet-label">
            Estimated Total Value (USD)
            <button
              type="button"
              className="home-eye-btn"
              onClick={() => setHideValue((v) => !v)}
              aria-label={hideValue ? 'Show balance' : 'Hide balance'}
            >
              {hideValue ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <div className="wallet-total-value">
            {hideValue ? <span className="wallet-value-mask">••••••</span> : usd(totalValue)}
          </div>

          <div className="wallet-actions">
            <Link to="/account/deposit" className="wallet-pill-btn wallet-pill-btn-deposit">
              <DepositIcon />
              Deposit
            </Link>
            <Link to="/account/withdraw" className="wallet-pill-btn wallet-pill-btn-withdraw">
              <WithdrawIcon />
              Withdrawal
            </Link>
          </div>
        </div>
      </div>

      <div className="wallet-portfolio-head">
        <h2>My Portfolio</h2>
        <span className="muted">{rows.length} {rows.length === 1 ? 'asset' : 'assets'}</span>
      </div>

      <div className="history-cards">
        {holdings.length === 0 && <div className="empty">You have no holdings yet. <Link to="/trade">Buy your first coin →</Link></div>}
        {rows.map((r) => (
          <div className="history-card" key={r.id}>
            <div className="history-card-top">
              <div className="history-card-icon-group">
                <span className="wallet-coin-icon-wrap">
                  {r.image && <img src={r.image} alt="" />}
                </span>
                <div>
                  <div className="history-card-symbol">{r.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{r.symbol?.toUpperCase()}</div>
                </div>
              </div>
              <div className="history-card-stake">{num(r.amount)}</div>
            </div>
            <div className="history-card-bottom">
              <div className="history-card-meta">Value</div>
              <div className="history-card-result" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {r.changePct != null && (
                  <span className={'home-wallet-change-pill ' + (r.changePct >= 0 ? 'up' : 'down')}>
                    {r.changePct >= 0 ? '▲' : '▼'} {Math.abs(r.changePct).toFixed(2)}%
                  </span>
                )}
                <div className="wallet-holding-value">{r.value != null ? usd(r.value) : '—'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
