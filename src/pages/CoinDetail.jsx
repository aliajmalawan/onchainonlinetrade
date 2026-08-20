import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getMarkets, getMarketChart } from '../lib/api'
import PriceChart from '../components/PriceChart'
import StatCard from '../components/StatCard'
import { usd, pct, compact, changeClass } from '../lib/format'

const RANGES = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

export default function CoinDetail() {
  const { id } = useParams()
  const [coin, setCoin] = useState(null)
  const [chart, setChart] = useState([])
  const [days, setDays] = useState(7)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [coinStatus, setCoinStatus] = useState('loading')
  const [coinError, setCoinError] = useState('')
  const [coinRetryTick, setCoinRetryTick] = useState(0)

  useEffect(() => {
    setCoinStatus((s) => (s === 'ready' ? s : 'loading'))
    getMarkets({ perPage: 100 })
      .then((data) => {
        setCoin(data.find((c) => c.id === id) || null)
        setCoinStatus('ready')
      })
      .catch((err) => {
        setCoinError(err.message)
        setCoinStatus('error')
      })
  }, [id, coinRetryTick])

  useEffect(() => {
    setStatus('loading')
    getMarketChart(id, days)
      .then((data) => {
        setChart((data.prices || []).map(([t, price]) => ({ t, price })))
        setStatus('ready')
      })
      .catch((err) => {
        setError(err.message)
        setStatus('error')
      })
  }, [id, days])

  const rising = useMemo(
    () => chart.length > 1 && chart[chart.length - 1].price >= chart[0].price,
    [chart]
  )

  return (
    <div>
      <div className="page-head">
        <Link to="/markets" className="muted">
          ← Markets
        </Link>
        <div className="spread" style={{ marginTop: 10 }}>
          <div className="coin-cell">
            {coin && <img src={coin.image} alt="" style={{ width: 34, height: 34 }} />}
            <div>
              <h1 style={{ fontSize: 24 }}>{coin ? coin.name : coinStatus === 'error' ? 'Coin' : 'Loading…'}</h1>
              {coin && <span className="sym">{coin.symbol}</span>}
            </div>
          </div>
          <div className="row" style={{ flex: '0 0 auto' }}>
            {RANGES.map((r) => (
              <button
                key={r.days}
                className={'btn btn-sm' + (days === r.days ? ' btn-primary' : '')}
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {coinStatus === 'loading' && <div className="loading">Loading market data…</div>}
      {coinStatus === 'error' && (
        <div className="alert alert-error spread">
          <span>{coinError || "Couldn't load market data. Try again shortly."}</span>
          <button className="btn btn-sm" onClick={() => setCoinRetryTick((n) => n + 1)}>
            Try again
          </button>
        </div>
      )}
      {coinStatus === 'ready' && coin && (
        <div className="stat-grid coin-detail-stat-grid">
          <StatCard label="PRICE" value={usd(coin.current_price)} />
          <StatCard
            label="24H CHANGE"
            value={pct(coin.price_change_percentage_24h)}
            valueClass={changeClass(coin.price_change_percentage_24h)}
          />
          <StatCard label="MARKET CAP" value={compact(coin.market_cap)} />
          <StatCard label="24H VOLUME" value={compact(coin.total_volume)} />
        </div>
      )}
      {coinStatus === 'ready' && !coin && (
        <div className="empty">Couldn't find that coin.</div>
      )}

      <div className="panel panel-pad mt-24">
        {status === 'loading' && <div className="loading">Loading chart…</div>}
        {status === 'error' && <div className="alert alert-error">{error}</div>}
        {status === 'ready' && <PriceChart data={chart} rising={rising} />}
      </div>
    </div>
  )
}
