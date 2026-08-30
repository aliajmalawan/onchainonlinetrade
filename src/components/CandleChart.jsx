import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createChart,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts'
import { usd, compact } from '../lib/format'

// TradingView's own signature candle palette — using it directly (rather
// than a generic green/red) is most of what makes a chart actually read as
// "TradingView-style" at a glance.
const UP = '#26a69a'
const DOWN = '#ef5350'
const UP_VOL = 'rgba(38, 166, 154, 0.5)'
const DOWN_VOL = 'rgba(239, 83, 80, 0.5)'
const BG = '#131722'
const PANEL = '#1e222d'
const GRID = 'rgba(255, 255, 255, 0.06)'
const BORDER = '#2a2e39'
const TEXT = '#787b86'
const ACCENT = '#2962ff'
const MA_COLOR = '#f0b429'
const EMA_COLOR = '#42a5f5'
const BB_COLOR = '#ab47bc'

const CHART_TYPES = [
  { key: 'candles', label: 'Candles' },
  { key: 'hollow', label: 'Hollow candles' },
  { key: 'bars', label: 'Bars' },
  { key: 'line', label: 'Line' },
  { key: 'area', label: 'Area' },
]

const INDICATORS = [
  { key: 'ma', label: 'Moving Average', sub: 'MA (9)', color: MA_COLOR },
  { key: 'ema', label: 'Exp. Moving Average', sub: 'EMA (20)', color: EMA_COLOR },
  { key: 'bb', label: 'Bollinger Bands', sub: 'BB (20, 2)', color: BB_COLOR },
]

// --- Indicator math — genuine calculations from the candle data we already
// have, not decorative lines. ---
function sma(candles, period) {
  const out = []
  let sum = 0
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close
    if (i >= period) sum -= candles[i - period].close
    if (i >= period - 1) out.push({ time: candles[i].time, value: sum / period })
  }
  return out
}
function ema(candles, period) {
  const out = []
  const k = 2 / (period + 1)
  let prev = null
  for (let i = 0; i < candles.length; i++) {
    prev = prev == null ? candles[i].close : candles[i].close * k + prev * (1 - k)
    if (i >= period - 1) out.push({ time: candles[i].time, value: prev })
  }
  return out
}
function bollinger(candles, period, mult) {
  const basis = [],
    upper = [],
    lower = []
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1)
    const mean = slice.reduce((s, c) => s + c.close, 0) / period
    const variance = slice.reduce((s, c) => s + (c.close - mean) ** 2, 0) / period
    const sd = Math.sqrt(variance)
    const time = candles[i].time
    basis.push({ time, value: mean })
    upper.push({ time, value: mean + mult * sd })
    lower.push({ time, value: mean - mult * sd })
  }
  return { basis, upper, lower }
}

function CandleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <line x1="4" y1="1" x2="4" y2="15" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2.3" y="5" width="3.4" height="6" fill="currentColor" />
      <line x1="12" y1="3" x2="12" y2="13" stroke="currentColor" strokeWidth="1.2" />
      <rect x="10.3" y="6" width="3.4" height="4" fill="currentColor" />
    </svg>
  )
}
function HollowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <line x1="4" y1="1" x2="4" y2="15" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2.3" y="5" width="3.4" height="6" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <line x1="12" y1="3" x2="12" y2="13" stroke="currentColor" strokeWidth="1.2" />
      <rect x="10.3" y="6" width="3.4" height="4" fill="currentColor" />
    </svg>
  )
}
function BarsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <line x1="4" y1="2" x2="4" y2="14" />
      <line x1="2" y1="5" x2="4" y2="5" />
      <line x1="4" y1="10" x2="6" y2="10" />
      <line x1="11" y1="4" x2="11" y2="13" />
      <line x1="9" y1="6" x2="11" y2="6" />
      <line x1="11" y1="9" x2="13" y2="9" />
    </svg>
  )
}
function LineIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <polyline points="1,12 5,7 8,9 15,2" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function AreaIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <polyline points="1,12 5,7 8,9 15,2" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1,12 5,7 8,9 15,2 V15 H1 Z" fill="currentColor" opacity="0.2" stroke="none" />
    </svg>
  )
}
function IndicatorIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M1 13 L5 6 L8 9 L15 1" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="5" cy="6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="9" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}
function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="4" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="9" r="3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 4L6.5 2h3l1 2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}
function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M1.5 5.5v-4h4M14.5 5.5v-4h-4M1.5 10.5v4h4M14.5 10.5v4h-4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function CompressIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M5.5 1.5v4h-4M10.5 1.5v4h4M5.5 14.5v-4h-4M10.5 14.5v-4h4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
      <line x1="11" y1="11" x2="15" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <polyline points="3,8 6,11 13,3" stroke={ACCENT} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
      <polyline points="3,5 8,11 13,5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const CHART_TYPE_ICONS = { candles: CandleIcon, hollow: HollowIcon, bars: BarsIcon, line: LineIcon, area: AreaIcon }

// Shared open/close + outside-click behavior for every toolbar dropdown.
function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])
  return { open, setOpen, ref }
}

function ToolbarButton({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        height: 28,
        padding: '0 6px',
        borderRadius: 4,
        border: 'none',
        background: active ? 'rgba(41, 98, 255, 0.15)' : 'transparent',
        color: active ? ACCENT : '#b2b5be',
        cursor: 'pointer',
        flex: '0 0 auto',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}

// Symbol search — a button showing the active coin that opens a filterable
// dropdown, mirroring the symbol box at the top-left of a real TradingView
// chart (click the symbol name there to search/switch markets).
function SymbolSearch({ coins, coinId, onSelect }) {
  const { open, setOpen, ref: wrapRef } = usePopover()
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  const current = coins.find((c) => c.id === coinId)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = !q ? coins : coins.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    return list.slice(0, 40)
  }, [coins, query])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          setQuery('')
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          border: 'none',
          background: open ? 'rgba(255,255,255,0.06)' : 'transparent',
          borderRadius: 4,
          padding: '4px 8px 4px 6px',
          cursor: 'pointer',
          color: '#d1d4dc',
        }}
      >
        {current?.image && <img src={current.image} alt="" style={{ width: 18, height: 18, borderRadius: '50%' }} />}
        <strong style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {current ? `${current.symbol.toUpperCase()}/USDT` : 'Select…'}
        </strong>
        <span style={{ color: TEXT }}>
          <ChevronIcon />
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            width: 260,
            maxHeight: 320,
            overflowY: 'auto',
            background: PANEL,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            zIndex: 10,
          }}
        >
          <div style={{ padding: 8, borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, background: PANEL }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: BG,
                border: `1px solid ${BORDER}`,
                borderRadius: 4,
                padding: '5px 8px',
              }}
            >
              <span style={{ color: TEXT }}>
                <SearchIcon />
              </span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search symbol…"
                style={{ background: 'transparent', border: 'none', outline: 'none', color: '#d1d4dc', fontSize: 13, width: '100%' }}
              />
            </div>
          </div>
          {filtered.length === 0 && <div style={{ padding: 12, fontSize: 12.5, color: TEXT }}>No matches.</div>}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(c.id)
                setOpen(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '7px 10px',
                background: c.id === coinId ? 'rgba(41, 98, 255, 0.12)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (c.id !== coinId) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              }}
              onMouseLeave={(e) => {
                if (c.id !== coinId) e.currentTarget.style.background = 'transparent'
              }}
            >
              {c.image && <img src={c.image} alt="" style={{ width: 18, height: 18, borderRadius: '50%' }} />}
              <span style={{ fontSize: 13, fontWeight: 600, color: '#d1d4dc' }}>{c.symbol.toUpperCase()}</span>
              <span style={{ fontSize: 12, color: TEXT }}>{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Chart type picker — Candles / Hollow candles / Bars / Line / Area, the
// subset of TradingView's "Bars" menu that lightweight-charts can actually
// render (footprint/volume-profile-style types need order-flow data no
// public API provides, so they're not on this list).
function ChartTypeMenu({ value, onChange }) {
  const { open, setOpen, ref } = usePopover()
  const ActiveIcon = CHART_TYPE_ICONS[value]
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <ToolbarButton onClick={() => setOpen((v) => !v)} title="Chart type">
        <ActiveIcon />
        <ChevronIcon />
      </ToolbarButton>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            width: 180,
            background: PANEL,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            zIndex: 10,
            padding: 4,
          }}
        >
          {CHART_TYPES.map((t) => {
            const Icon = CHART_TYPE_ICONS[t.key]
            const active = t.key === value
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  onChange(t.key)
                  setOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '7px 8px',
                  background: active ? 'rgba(41, 98, 255, 0.12)' : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: active ? ACCENT : '#d1d4dc',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent'
                }}
              >
                <Icon />
                <span style={{ fontSize: 13 }}>{t.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Indicators — a small curated set of genuinely calculated overlays (not
// TradingView's full Pine Script library, which is a whole separate
// product), toggled on/off like a real indicators menu.
function IndicatorsMenu({ active, onToggle }) {
  const { open, setOpen, ref } = usePopover()
  const activeCount = Object.values(active).filter(Boolean).length
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <ToolbarButton active={activeCount > 0} onClick={() => setOpen((v) => !v)} title="Indicators">
        <IndicatorIcon />
        <span style={{ fontSize: 12, fontWeight: 600 }}>Indicators</span>
        <ChevronIcon />
      </ToolbarButton>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            width: 220,
            background: PANEL,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            zIndex: 10,
            padding: 4,
          }}
        >
          {INDICATORS.map((ind) => {
            const isOn = !!active[ind.key]
            return (
              <button
                key={ind.key}
                type="button"
                onClick={() => onToggle(ind.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: ind.color, flex: '0 0 auto' }} />
                <span style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#d1d4dc' }}>{ind.label}</div>
                  <div style={{ fontSize: 11, color: TEXT }}>{ind.sub}</div>
                </span>
                <span style={{ width: 16, opacity: isOn ? 1 : 0 }}>
                  <CheckIcon />
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// data: [{ t: <ms>, open, high, low, close, volume }]
export default function CandleChart({ data, coins, coinId, onSelectCoin, ranges, activeRange, onSelectRange }) {
  const outerRef = useRef(null)
  const containerRef = useRef(null)
  const seriesRef = useRef({ indicatorSeries: {} })
  const [legend, setLegend] = useState(null)
  const [seriesType, setSeriesType] = useState('candles')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeIndicators, setActiveIndicators] = useState({ ma: false, ema: false, bb: false })

  const current = (coins || []).find((c) => c.id === coinId)
  const symbol = current ? `${current.symbol.toUpperCase()}/USDT` : ''

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(document.fullscreenElement === outerRef.current)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: BG },
        textColor: TEXT,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: 12,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.2)', labelBackgroundColor: '#363a45' },
        horzLine: { color: 'rgba(255,255,255,0.2)', labelBackgroundColor: '#363a45' },
      },
      rightPriceScale: { borderColor: BORDER },
      timeScale: { borderColor: BORDER, timeVisible: true, secondsVisible: false },
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      priceLineVisible: false,
      lastValueVisible: false,
    })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })

    chart.subscribeCrosshairMove((param) => {
      const s = seriesRef.current
      const point = s.mainSeries ? param.seriesData?.get(s.mainSeries) : null
      const vol = param.seriesData?.get(volumeSeries)
      if (point) {
        setLegend(
          point.open !== undefined
            ? { open: point.open, high: point.high, low: point.low, close: point.close, volume: vol?.value ?? null }
            : { close: point.value, volume: vol?.value ?? null }
        )
      } else {
        setLegend(null)
      }
    })

    seriesRef.current = { chart, volumeSeries, mainSeries: null, indicatorSeries: {} }

    return () => {
      chart.remove()
      seriesRef.current = { indicatorSeries: {} }
    }
  }, [])

  // (Re)build the price series whenever the chart type toggles, and feed
  // it + volume whenever new data arrives — swapping series type means
  // removing the old one and adding a fresh one, lightweight-charts has no
  // in-place "change series type" API.
  useEffect(() => {
    const s = seriesRef.current
    if (!s.chart || !data?.length) return

    if (s.mainSeries) {
      s.chart.removeSeries(s.mainSeries)
      s.mainSeries = null
    }

    const candles = data.map((d) => ({ time: Math.floor(d.t / 1000), open: d.open, high: d.high, low: d.low, close: d.close }))
    const priceMargins = { top: 0.1, bottom: 0.25 }

    if (seriesType === 'line') {
      const lineSeries = s.chart.addSeries(LineSeries, { color: ACCENT, lineWidth: 2, priceLineVisible: true })
      lineSeries.priceScale().applyOptions({ scaleMargins: priceMargins })
      lineSeries.setData(candles.map((c) => ({ time: c.time, value: c.close })))
      s.mainSeries = lineSeries
    } else if (seriesType === 'area') {
      const areaSeries = s.chart.addSeries(AreaSeries, {
        lineColor: ACCENT,
        topColor: 'rgba(41, 98, 255, 0.35)',
        bottomColor: 'rgba(41, 98, 255, 0.02)',
        lineWidth: 2,
      })
      areaSeries.priceScale().applyOptions({ scaleMargins: priceMargins })
      areaSeries.setData(candles.map((c) => ({ time: c.time, value: c.close })))
      s.mainSeries = areaSeries
    } else if (seriesType === 'bars') {
      const barSeries = s.chart.addSeries(BarSeries, { upColor: UP, downColor: DOWN, thinBars: false })
      barSeries.priceScale().applyOptions({ scaleMargins: priceMargins })
      barSeries.setData(candles)
      s.mainSeries = barSeries
    } else {
      // 'candles' and 'hollow' both use CandlestickSeries — hollow simply
      // fills up-candles with the chart's own background instead of a
      // solid color, leaving just the colored outline (a real, standard
      // "hollow candles" rendering, not a fake/simplified stand-in).
      const hollow = seriesType === 'hollow'
      const candleSeries = s.chart.addSeries(CandlestickSeries, {
        upColor: hollow ? BG : UP,
        downColor: DOWN,
        borderUpColor: UP,
        borderDownColor: DOWN,
        wickUpColor: UP,
        wickDownColor: DOWN,
      })
      candleSeries.priceScale().applyOptions({ scaleMargins: priceMargins })
      candleSeries.setData(candles)
      s.mainSeries = candleSeries
    }

    const volumes = data.map((d, i) => ({
      time: candles[i].time,
      value: d.volume ?? 0,
      color: d.close >= d.open ? UP_VOL : DOWN_VOL,
    }))
    s.volumeSeries.setData(volumes)
    s.chart.timeScale().fitContent()

    const last = data[data.length - 1]
    setLegend({ open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume ?? null })
  }, [data, seriesType])

  // Keep indicator overlays in sync with their on/off state and with new
  // data — added/removed as real chart series, not drawn separately.
  useEffect(() => {
    const s = seriesRef.current
    if (!s.chart) return
    const store = s.indicatorSeries

    function ensureOff(key) {
      const existing = store[key]
      if (!existing) return
      ;(Array.isArray(existing) ? existing : [existing]).forEach((series) => s.chart.removeSeries(series))
      delete store[key]
    }

    if (!data?.length) {
      Object.keys(store).forEach(ensureOff)
      return
    }

    const candles = data.map((d) => ({ time: Math.floor(d.t / 1000), close: d.close }))

    if (activeIndicators.ma) {
      if (!store.ma) store.ma = s.chart.addSeries(LineSeries, { color: MA_COLOR, lineWidth: 2, priceLineVisible: false, lastValueVisible: false })
      store.ma.setData(sma(candles, 9))
    } else ensureOff('ma')

    if (activeIndicators.ema) {
      if (!store.ema) store.ema = s.chart.addSeries(LineSeries, { color: EMA_COLOR, lineWidth: 2, priceLineVisible: false, lastValueVisible: false })
      store.ema.setData(ema(candles, 20))
    } else ensureOff('ema')

    if (activeIndicators.bb) {
      if (!store.bb) {
        const mk = (dashed) =>
          s.chart.addSeries(LineSeries, {
            color: BB_COLOR,
            lineWidth: 1,
            lineStyle: dashed ? 2 : 0,
            priceLineVisible: false,
            lastValueVisible: false,
          })
        store.bb = [mk(true), mk(false), mk(true)]
      }
      const { basis, upper, lower } = bollinger(candles, 20, 2)
      store.bb[0].setData(upper)
      store.bb[1].setData(basis)
      store.bb[2].setData(lower)
    } else ensureOff('bb')
  }, [data, activeIndicators])

  function toggleIndicator(key) {
    setActiveIndicators((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleScreenshot() {
    const chart = seriesRef.current.chart
    if (!chart) return
    const canvas = chart.takeScreenshot()
    const link = document.createElement('a')
    link.download = `${current?.symbol?.toUpperCase() || 'chart'}-usdt.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      outerRef.current?.requestFullscreen()
    }
  }

  const first = data?.[0]
  const last = data?.[data.length - 1]
  const changeAbs = last && first ? last.close - first.open : 0
  const changePct = first?.open ? (changeAbs / first.open) * 100 : 0
  const isUp = changeAbs >= 0
  const legendColor = legend && legend.open != null ? (legend.close >= legend.open ? UP : DOWN) : '#d1d4dc'

  return (
    <div
      ref={outerRef}
      style={{ position: 'relative', background: BG, borderRadius: 8, overflow: 'hidden', border: `1px solid ${BORDER}` }}
    >
      {/* Toolbar — symbol search + intervals on the left, chart type /
          indicators / screenshot / fullscreen on the right, matching a
          real TradingView chart's top bar layout. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 8px',
          borderBottom: `1px solid ${BORDER}`,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {coins && onSelectCoin && <SymbolSearch coins={coins} coinId={coinId} onSelect={onSelectCoin} />}
          {ranges && (
            <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
              {ranges.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => onSelectRange(r)}
                  style={{
                    border: 'none',
                    background: activeRange?.label === r.label ? 'rgba(41, 98, 255, 0.15)' : 'transparent',
                    color: activeRange?.label === r.label ? ACCENT : '#b2b5be',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '4px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <ChartTypeMenu value={seriesType} onChange={setSeriesType} />
          <IndicatorsMenu active={activeIndicators} onToggle={toggleIndicator} />
          <div style={{ width: 1, height: 18, background: BORDER, margin: '0 4px' }} />
          <ToolbarButton onClick={handleScreenshot} title="Download screenshot">
            <CameraIcon />
          </ToolbarButton>
          <ToolbarButton onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <CompressIcon /> : <ExpandIcon />}
          </ToolbarButton>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 12,
            right: 76,
            zIndex: 2,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: 13,
            color: '#d1d4dc',
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
            {symbol && <strong style={{ fontWeight: 600 }}>{symbol}</strong>}
            {activeRange && <span style={{ color: TEXT, fontSize: 12 }}>{activeRange.label}</span>}
            {first && last && (
              <span style={{ color: isUp ? UP : DOWN, fontSize: 12 }}>
                {isUp ? '+' : ''}
                {usd(changeAbs)} ({isUp ? '+' : ''}
                {changePct.toFixed(2)}%)
              </span>
            )}
            {(activeIndicators.ma || activeIndicators.ema || activeIndicators.bb) && (
              <span style={{ display: 'flex', gap: 8 }}>
                {activeIndicators.ma && <span style={{ color: MA_COLOR, fontSize: 11 }}>MA 9</span>}
                {activeIndicators.ema && <span style={{ color: EMA_COLOR, fontSize: 11 }}>EMA 20</span>}
                {activeIndicators.bb && <span style={{ color: BB_COLOR, fontSize: 11 }}>BB 20,2</span>}
              </span>
            )}
          </div>
          {legend && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: legendColor, marginTop: 2 }}>
              {legend.open != null ? (
                <>
                  <span>O{usd(legend.open)}</span>
                  <span>H{usd(legend.high)}</span>
                  <span>L{usd(legend.low)}</span>
                  <span>C{usd(legend.close)}</span>
                </>
              ) : (
                <span>{usd(legend.close)}</span>
              )}
              {legend.volume != null && <span style={{ color: TEXT }}>Vol {compact(legend.volume)}</span>}
            </div>
          )}
        </div>
        <div ref={containerRef} style={{ width: '100%', height: isFullscreen ? 'calc(100vh - 41px)' : 420 }} />
      </div>
    </div>
  )
}
