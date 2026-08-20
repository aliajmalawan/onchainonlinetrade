import { Link } from 'react-router-dom'
import Sparkline from './Sparkline'
import { usd, pct, compact, changeClass } from '../lib/format'

export default function CoinTable({ coins, onAdd }) {
  return (
    <div className="panel table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th className="hide-narrow" style={{ width: 40 }}>#</th>
            <th>Coin</th>
            <th className="right">Price</th>
            <th className="right">24h</th>
            <th className="right hide-narrow">Market cap</th>
            <th className="right hide-narrow">7d</th>
            {onAdd && <th></th>}
          </tr>
        </thead>
        <tbody>
          {coins.map((c) => (
            <tr key={c.id}>
              <td className="muted mono hide-narrow">{c.market_cap_rank}</td>
              <td>
                <Link to={`/coin/${c.id}`} className="coin-cell" style={{ color: 'inherit' }}>
                  <img src={c.image} alt="" />
                  <span>
                    {c.name} <span className="sym">{c.symbol}</span>
                  </span>
                </Link>
              </td>
              <td className="num">{usd(c.current_price)}</td>
              <td className={'num ' + changeClass(c.price_change_percentage_24h)}>
                {pct(c.price_change_percentage_24h)}
              </td>
              <td className="num muted hide-narrow">{compact(c.market_cap)}</td>
              <td className="right hide-narrow">
                <Sparkline data={c.sparkline_in_7d?.price || []} />
              </td>
              {onAdd && (
                <td className="right">
                  <button className="btn btn-sm" onClick={() => onAdd(c)}>
                    + Add
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
