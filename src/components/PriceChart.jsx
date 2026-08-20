import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { usd } from '../lib/format'

// data: [{ t: <ms>, price: <number> }]
export default function PriceChart({ data, rising }) {
  const color = rising ? '#16a34a' : '#dc2626'

  // Short intraday ranges (the Trade page's 1m/5m/15m/1h views) span well
  // under a day — a date-only label would repeat the same day on every
  // tick, so switch to a time-of-day label whenever the span is that tight.
  const spanMs = data.length > 1 ? data[data.length - 1].t - data[0].t : 0
  const showTime = spanMs > 0 && spanMs < 24 * 60 * 60 * 1000

  const fmtTime = (t) =>
    showTime
      ? new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // Stablecoins barely move, so an "auto" domain can end up with tick values
  // that only differ in the 5th+ decimal place — the default $0.9994-style
  // formatting then prints the same rounded label on every tick. Detect a
  // tight price range and format with enough decimals to tell them apart.
  const prices = data.map((d) => d.price)
  const priceSpan = prices.length ? Math.max(...prices) - Math.min(...prices) : 0
  const tightRange = priceSpan > 0 && priceSpan < 0.01
  const yDecimals = tightRange ? 6 : undefined

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#e3e7f0" vertical={false} />
        <XAxis
          dataKey="t"
          tickFormatter={fmtTime}
          tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          stroke="#e3e7f0"
          minTickGap={40}
        />
        <YAxis
          domain={['auto', 'auto']}
          tickFormatter={(v) => usd(v, { max: yDecimals ?? 0 })}
          tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          stroke="#e3e7f0"
          width={tightRange ? 88 : 72}
        />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid #e3e7f0',
            borderRadius: 8,
            fontFamily: 'JetBrains Mono',
            fontSize: 12,
          }}
          labelStyle={{ color: '#64748b' }}
          labelFormatter={(t) => new Date(t).toLocaleString()}
          formatter={(v) => [usd(v), 'Price']}
        />
        <Area
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={2}
          fill="url(#priceFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
