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

export default function Wallet() {
  const [coins, setCoins] = useState([])
  const [holdings, setHoldings] = useState([])

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
        const live = priceById[h.coinId]?.current_price ?? null
        return { ...h, value: live != null ? live * h.amount : null }
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
        <div className="muted" style={{ fontSize: 13 }}>Est. Total Value (USD)</div>
        <div className="wallet-total-value">{usd(totalValue)}</div>

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

      <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 12 }}>My Portfolio</h2>

      <div className="history-cards">
        {holdings.length === 0 && <div className="empty">You have no holdings yet. <Link to="/trade">Buy your first coin →</Link></div>}
        {rows.map((r) => (
          <div className="history-card" key={r.id}>
            <div className="history-card-top">
              <div className="history-card-icon-group">
                {r.image && <img src={r.image} alt="" />}
                <div>
                  <div className="history-card-symbol">{r.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{r.symbol?.toUpperCase()}</div>
                </div>
              </div>
              <div className="history-card-stake">{num(r.amount)}</div>
            </div>
            <div className="history-card-bottom">
              <div className="history-card-meta">Value</div>
              <div className="history-card-result">{r.value != null ? usd(r.value) : '—'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
