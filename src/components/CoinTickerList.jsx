import { Link } from 'react-router-dom'
import { compact } from '../lib/format'

function ArrowIcon({ up }) {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      {up ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
    </svg>
  )
}

function formatPrice(price) {
  if (price == null || Number.isNaN(price)) return '—'
  const decimals = price < 1 ? 5 : price < 100 ? 4 : 2
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(price)
}

// A live-ticking coin list — coin price/24h stats are refreshed from
// Binance every few seconds by the caller (CoinGecko's own snapshot barely
// moves inside a few seconds), and each row briefly flashes green/red when
// its price actually changes tick-to-tick.
export default function CoinTickerList({ coins }) {
  return (
    <div className="ticker-list">
      {coins.map((c) => {
        const isUp = (c.price_change_percentage_24h || 0) >= 0
        const flashStyle =
          c.flash === 'up'
            ? { background: 'rgba(22, 163, 74, 0.22)' }
            : c.flash === 'down'
            ? { background: 'rgba(220, 38, 38, 0.22)' }
            : undefined

        return (
          <Link to={`/coin/${c.id}`} key={c.id} className="ticker-row" style={flashStyle}>
            <img src={c.image} alt="" className="ticker-icon" />
            <div className="ticker-main">
              <div className="ticker-name-row">
                <span className="ticker-name">{c.symbol?.toUpperCase()}</span>
                <span className="ticker-badge">USD</span>
              </div>
              <div className="ticker-sub">
                24H Vol {compact(c.total_volume)} · High {formatPrice(c.high_24h)}
              </div>
            </div>
            <div className="ticker-right">
              <div className="ticker-price">{formatPrice(c.current_price)}</div>
              <div className={'ticker-pct ' + (isUp ? 'ticker-pct-up' : 'ticker-pct-down')}>
                <ArrowIcon up={isUp} />
                {Math.abs(c.price_change_percentage_24h || 0).toFixed(2)}%
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
