import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, ColorType, CrosshairMode } from 'lightweight-charts'
import { usd, compact } from '../lib/format'

// TradingView's own signature candle palette — using it directly (rather
// than a generic green/red) is most of what makes a chart actually read as
// "TradingView-style" at a glance.
const UP = '#26a69a'
const DOWN = '#ef5350'
const UP_VOL = 'rgba(38, 166, 154, 0.5)'
const DOWN_VOL = 'rgba(239, 83, 80, 0.5)'
const BG = '#131722'
const GRID = 'rgba(255, 255, 255, 0.06)'
const BORDER = '#2a2e39'
const TEXT = '#787b86'

// data: [{ t: <ms>, open, high, low, close, volume }]
export default function CandleChart({ data, symbol, intervalLabel }) {
  const containerRef = useRef(null)
  const seriesRef = useRef({})
  const [legend, setLegend] = useState(null)

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

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
    })
    candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.25 } })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      priceLineVisible: false,
      lastValueVisible: false,
    })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })

    chart.subscribeCrosshairMove((param) => {
      const point = param.seriesData?.get(candleSeries)
      const vol = param.seriesData?.get(volumeSeries)
      if (point) {
        setLegend({ open: point.open, high: point.high, low: point.low, close: point.close, volume: vol?.value ?? null })
      } else {
        setLegend(null)
      }
    })

    seriesRef.current = { chart, candleSeries, volumeSeries }

    return () => {
      chart.remove()
      seriesRef.current = {}
    }
  }, [])

  useEffect(() => {
    const s = seriesRef.current
    if (!s.candleSeries || !data?.length) return

    const candles = data.map((d) => ({ time: Math.floor(d.t / 1000), open: d.open, high: d.high, low: d.low, close: d.close }))
    const volumes = data.map((d, i) => ({
      time: candles[i].time,
      value: d.volume ?? 0,
      color: d.close >= d.open ? UP_VOL : DOWN_VOL,
    }))

    s.candleSeries.setData(candles)
    s.volumeSeries.setData(volumes)
    s.chart.timeScale().fitContent()

    const last = data[data.length - 1]
    setLegend({ open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume ?? null })
  }, [data])

  const first = data?.[0]
  const last = data?.[data.length - 1]
  const changeAbs = last && first ? last.close - first.open : 0
  const changePct = first?.open ? (changeAbs / first.open) * 100 : 0
  const isUp = changeAbs >= 0
  const legendColor = legend && legend.close >= legend.open ? UP : DOWN

  return (
    <div style={{ position: 'relative', background: BG, borderRadius: 8, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
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
          {intervalLabel && <span style={{ color: TEXT, fontSize: 12 }}>{intervalLabel}</span>}
          {first && last && (
            <span style={{ color: isUp ? UP : DOWN, fontSize: 12 }}>
              {isUp ? '+' : ''}
              {usd(changeAbs)} ({isUp ? '+' : ''}
              {changePct.toFixed(2)}%)
            </span>
          )}
        </div>
        {legend && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: legendColor, marginTop: 2 }}>
            <span>O{usd(legend.open)}</span>
            <span>H{usd(legend.high)}</span>
            <span>L{usd(legend.low)}</span>
            <span>C{usd(legend.close)}</span>
            {legend.volume != null && <span style={{ color: TEXT }}>Vol {compact(legend.volume)}</span>}
          </div>
        )}
      </div>
      <div ref={containerRef} style={{ width: '100%', height: 420 }} />
    </div>
  )
}
