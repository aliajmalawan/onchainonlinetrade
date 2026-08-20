// Small formatting helpers used across the app.

export function usd(value, opts = {}) {
  if (value == null || Number.isNaN(value)) return '—'
  const { max = 2 } = opts
  // Show more decimals for tiny prices (e.g. meme coins).
  const min = value !== 0 && Math.abs(value) < 1 ? 4 : 2
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: min,
    maximumFractionDigits: Math.max(max, min),
  }).format(value)
}

export function compact(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

export function pct(value) {
  if (value == null || Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function num(value, digits = 4) {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
  }).format(value)
}

// Return a className string for gain/loss colouring.
export function changeClass(value) {
  if (value == null || Number.isNaN(value)) return ''
  return value >= 0 ? 'up' : 'down'
}

// Human-readable elapsed time since a date (e.g. "3d 4h", "45m", "just now").
// Used to show how long a position has been held — informational only.
export function duration(since) {
  if (!since) return '—'
  const ms = Date.now() - new Date(since).getTime()
  if (ms < 0) return 'just now'

  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m`
  return 'just now'
}
