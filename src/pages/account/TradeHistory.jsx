import { useEffect, useState } from 'react'
import { apiGetTradeHistory } from '../../lib/backend'
import { getMarkets } from '../../lib/api'
import { usd, num } from '../../lib/format'

const ACTION_LABEL = { add: 'Added', update: 'Adjusted', remove: 'Removed' }

// Short "Aug 13, 2026 · 15:42" style stamp used on the trade card.
const fmtCardDate = (t) => {
  const d = new Date(t)
  const date = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${date} · ${time}`
}

// A real Buy Long / Sell Short trade (has a direction) gets the rich
// entry/exit/profit card; an admin holding correction (add/update/remove,
// no direction) falls back to the simpler action-badge card.
function TradeCard({ t }) {
  if (t.direction) {
    const isBuy = t.direction === 'buy'
    const isProfit = t.result === 'Profit'
    const delta = isProfit ? t.profitAmount : t.lossAmount
    return (
      <div className="history-card">
        <div className="history-card-top">
          <div className="history-card-icon-group">
            {t.image && <img src={t.image} alt="" />}
            <span className="history-card-symbol">{t.symbol.toUpperCase()}</span>
            <span className={'badge ' + (isBuy ? 'badge-buy' : 'badge-sell')}>{isBuy ? 'BUY' : 'SELL'}</span>
          </div>
          <div className="history-card-stake">{usd(t.amount)}</div>
        </div>
        <div className="history-card-bottom">
          <div className="history-card-meta">
            {fmtCardDate(t.createdAt)}
            <br />
            Entry: {usd(t.openingPrice)} • Exit: {usd(t.closingPrice)}
          </div>
          <div className="history-card-result">
            <div className={isProfit ? 'up' : 'down'}>
              {isProfit ? '+' : '-'}
              {usd(delta)}
            </div>
            <div className={'history-card-result-label ' + (isProfit ? 'up' : 'down')}>{t.result?.toUpperCase()}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="history-card">
      <div className="history-card-top">
        <div className="history-card-icon-group">
          {t.image && <img src={t.image} alt="" />}
          <span className="history-card-symbol">{t.name} <span className="muted">({t.symbol.toUpperCase()})</span></span>
          <span
            className={
              'badge ' +
              (t.action === 'remove' ? 'badge-action-remove' : t.action === 'add' ? 'badge-action-add' : 'badge-action-update')
            }
          >
            {ACTION_LABEL[t.action] || t.action}
          </span>
        </div>
        <div className="history-card-stake">{num(t.amount)}</div>
      </div>
      <div className="history-card-bottom">
        <div className="history-card-meta">{fmtCardDate(t.createdAt)}</div>
        <div className="history-card-result">{usd(t.price)}</div>
      </div>
    </div>
  )
}

export default function TradeHistory() {
  const [trades, setTrades] = useState(null)
  const [coins, setCoins] = useState([])

  useEffect(() => {
    apiGetTradeHistory().then(setTrades).catch(() => setTrades([]))
    getMarkets({ perPage: 100 }).then(setCoins).catch(() => {})
  }, [])

  const imageById = {}
  coins.forEach((c) => (imageById[c.id] = c.image))
  const tradesWithImages = trades?.map((t) => ({ ...t, image: imageById[t.coinId] }))

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Account</div>
        <h1>Trade history</h1>
        <p>A log of holdings added, adjusted, or removed in your portfolio.</p>
      </div>

      <div className="history-cards">
        {trades === null && <div className="muted">Loading…</div>}
        {trades?.length === 0 && <div className="empty">No activity yet.</div>}
        {tradesWithImages?.map((t) => (
          <TradeCard key={t.id} t={t} />
        ))}
      </div>
    </div>
  )
}
