// Tiny inline-SVG sparkline. Takes an array of numbers.
export default function Sparkline({ data = [], width = 96, height = 30 }) {
  if (!data || data.length < 2) return <span className="muted">—</span>

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)

  const points = data
    .map((v, i) => {
      const x = i * stepX
      const y = height - ((v - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const rising = data[data.length - 1] >= data[0]
  const stroke = rising ? 'var(--up)' : 'var(--down)'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
