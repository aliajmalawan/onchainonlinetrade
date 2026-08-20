import { useEffect, useState } from 'react'
import CoinTable from '../components/CoinTable'
import { getMarkets } from '../lib/api'

export default function Markets() {
  const [coins, setCoins] = useState([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    getMarkets({ perPage: 50 })
      .then((data) => {
        setCoins(data)
        setStatus('ready')
      })
      .catch((err) => {
        setError(err.message)
        setStatus('error')
      })
  }, [])

  const filtered = coins.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.symbol.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div>
      <div className="page-head spread">
        <div>
          <div className="eyebrow">Live · CoinGecko</div>
          <h1>Markets</h1>
          <p>Live market board — real-time ticker updates for the most active spot pairs, organized into gainers, losers, and featured coins.</p>
        </div>
        <input
          className="input"
          style={{ maxWidth: 240 }}
          placeholder="Search coin…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {status === 'loading' && <div className="loading">Loading markets…</div>}
      {status === 'error' && <div className="alert alert-error">{error}</div>}
      {status === 'ready' &&
        (filtered.length ? (
          <CoinTable coins={filtered} />
        ) : (
          <div className="panel empty">No coins match “{query}”.</div>
        ))}
    </div>
  )
}
