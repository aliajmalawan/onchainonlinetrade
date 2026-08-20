import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { usd } from '../lib/format'

const UP = '#16a34a'
const DOWN = '#dc2626'

// Recharts has no built-in candlestick — this is the standard trick: give
// the Bar a [low, high] range so recharts positions/scales it correctly,
// then draw the wick + open/close body ourselves inside a custom shape
// using that same y-scale (derived from the bar's own y/height).
function Candle({ x, y, width, height, payload }) {
  const { open, close, high, low } = payload
  const isUp = close >= open
  const color = isUp ? UP : DOWN
  const range = high - low || 1
  const pxPerUnit = height / range

  const bodyTopVal = Math.max(open, close)
  const bodyBottomVal = Math.min(open, close)
  const bodyY = y + (high - bodyTopVal) * pxPerUnit
  const bodyHeight = Math.max((bodyTopVal - bodyBottomVal) * pxPerUnit, 1)
  const wickX = x + width / 2
  const bodyWidth = Math.max(width * 0.7, 2)
  const bodyX = x + (width - bodyWidth) / 2

  return (
    <g>
      <line x1={wickX} x2={wickX} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={bodyX} y={bodyY} width={bodyWidth} height={bodyHeight} fill={color} />
    </g>
  )
}

function CandleTooltip({ active, payload, showTime }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e3e7f0',
        borderRadius: 8,
        fontFamily: 'JetBrains Mono',
        fontSize: 12,
        padding: '8px 10px',
        color: '#101828',
      }}
    >
      <div style={{ color: '#64748b', marginBottom: 4 }}>
        {showTime
          ? new Date(d.t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : new Date(d.t).toLocaleString()}
      </div>
      <div>O: {usd(d.open)}</div>
      <div>H: {usd(d.high)}</div>
      <div>L: {usd(d.low)}</div>
      <div>C: {usd(d.close)}</div>
    </div>
  )
}

// data: [{ t: <ms>, open, high, low, close }]
export default function CandleChart({ data }) {
  const spanMs = data.length > 1 ? data[data.length - 1].t - data[0].t : 0
  const showTime = spanMs > 0 && spanMs < 24 * 60 * 60 * 1000

  const fmtTime = (t) =>
    showTime
      ? new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const highs = data.map((d) => d.high)
  const lows = data.map((d) => d.low)
  const priceSpan = highs.length ? Math.max(...highs) - Math.min(...lows) : 0
  const tightRange = priceSpan > 0 && priceSpan < 0.01
  const yDecimals = tightRange ? 6 : undefined

  const chartData = data.map((d) => ({ ...d, range: [d.low, d.high] }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
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
        <Tooltip content={<CandleTooltip showTime={showTime} />} cursor={{ fill: 'rgba(100,116,139,0.08)' }} />
        <Bar dataKey="range" shape={<Candle />} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
