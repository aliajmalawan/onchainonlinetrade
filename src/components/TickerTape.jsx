import { useEffect, useState } from 'react'
import { getMarkets } from '../lib/api'
import { usd, pct, changeClass } from '../lib/format'

// Scrolling market ticker — the app's signature element.
export default function TickerTape() {
  const [coins, setCoins] = useState([])

  useEffect(() => {
    let alive = true
    getMarkets({ perPage: 15 })
      .then((data) => alive && setCoins(data))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  if (!coins.length) {
    return (
      <div className="ticker">
        <div style={{ paddingLeft: 20 }} className="ticker-item">
          loading market data…
        </div>
      </div>
    )
  }

  // Duplicate the list so the scroll loop has no visible gap.
  const items = [...coins, ...coins]

  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {items.map((c, i) => (
          <span className="ticker-item" key={c.id + '-' + i}>
            <strong>{c.symbol.toUpperCase()}</strong>
            <span>{usd(c.current_price)}</span>
            <span className={changeClass(c.price_change_percentage_24h)}>
              {pct(c.price_change_percentage_24h)}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
