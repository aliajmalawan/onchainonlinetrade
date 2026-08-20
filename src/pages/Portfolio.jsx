import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMarkets } from '../lib/api'
import { apiGetPortfolio } from '../lib/backend'
import StatCard from '../components/StatCard'
import { usd, pct, num, changeClass, duration } from '../lib/format'

export default function Portfolio() {
  const { user } = useAuth()
  const [coins, setCoins] = useState([])
  const [holdings, setHoldings] = useState([])

  useEffect(() => {
    getMarkets({ perPage: 100 }).then(setCoins).catch(() => {})
  }, [])

  useEffect(() => {
    refresh()
  }, [user.id])

  const priceById = useMemo(() => {
    const map = {}
    coins.forEach((c) => (map[c.id] = c))
    return map
  }, [coins])

  function refresh() {
    apiGetPortfolio().then(setHoldings).catch(() => setHoldings([]))
  }

  const rows = holdings.map((h) => {
    const live = priceById[h.coinId]?.current_price ?? null
    const value = live != null ? live * h.amount : null
    const cost = h.buyPrice * h.amount
    const pnl = value != null ? value - cost : null
    const pnlPct = pnl != null && cost > 0 ? (pnl / cost) * 100 : null
    return { ...h, live, value, cost, pnl, pnlPct }
  })

  const totalValue = rows.reduce((s, r) => s + (r.value || 0), 0)
  const totalCost = rows.reduce((s, r) => s + r.cost, 0)
  const totalPnl = totalValue - totalCost
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Your holdings</div>
        <h1>Portfolio</h1>
        <p>Track what you own and see real profit/loss against live prices.</p>
      </div>

      <div className="stat-grid">
        <StatCard label="TOTAL VALUE" value={usd(totalValue)} />
        <StatCard label="TOTAL COST" value={usd(totalCost)} />
        <StatCard
          label="PROFIT / LOSS"
          value={usd(totalPnl)}
          delta={pct(totalPnlPct)}
          deltaClass={changeClass(totalPnl)}
        />
      </div>

      {/* Holdings table */}
      <div className="panel table-wrap mt-24">
        <table className="data">
          <thead>
            <tr>
              <th>Coin</th>
              <th className="right">Amount</th>
              <th className="right hide-narrow">Buy price</th>
              <th className="right">Now</th>
              <th className="right">Value</th>
              <th className="right">P/L</th>
              <th className="right hide-narrow">Held for</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  No holdings yet — <Link to="/trade">buy your first coin →</Link>
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="coin-cell">
                    <img src={r.image} alt="" />
                    <span>
                      {r.name} <span className="sym">{r.symbol}</span>
                    </span>
                  </span>
                </td>
                <td className="num">{num(r.amount)}</td>
                <td className="num hide-narrow">{usd(r.buyPrice)}</td>
                <td className="num">{r.live != null ? usd(r.live) : '—'}</td>
                <td className="num">{r.value != null ? usd(r.value) : '—'}</td>
                <td className={'num ' + changeClass(r.pnl)}>
                  {r.pnl != null ? `${usd(r.pnl)} (${pct(r.pnlPct)})` : '—'}
                </td>
                <td className="num muted mono hide-narrow">{duration(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
