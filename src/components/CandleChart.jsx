import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, ColorType, CrosshairMode } from 'lightweight-charts'
import { usd, compact } from '../lib/format'

const UP = '#16a34a'
const DOWN = '#dc2626'
const UP_VOL = 'rgba(22, 163, 74, 0.5)'
const DOWN_VOL = 'rgba(220, 38, 38, 0.5)'
const MA_FAST_COLOR = '#f0b429'
const MA_SLOW_COLOR = '#60a5fa'
const MA_FAST_PERIOD = 9
const MA_SLOW_PERIOD = 20
const BG = '#131722'
const GRID = 'rgba(255, 255, 255, 0.06)'
const BORDER = '#232733'
const TEXT = '#9aa4b2'

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
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.25)', labelBackgroundColor: '#2b3040' },
        horzLine: { color: 'rgba(255,255,255,0.25)', labelBackgroundColor: '#2b3040' },
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
    candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.24 } })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      priceLineVisible: false,
      lastValueVisible: false,
    })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })

    const maFast = chart.addSeries(LineSeries, {
      color: MA_FAST_COLOR,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    const maSlow = chart.addSeries(LineSeries, {
      color: MA_SLOW_COLOR,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    chart.subscribeCrosshairMove((param) => {
      const point = param.seriesData?.get(candleSeries)
      const vol = param.seriesData?.get(volumeSeries)
      if (point) {
        setLegend({ open: point.open, high: point.high, low: point.low, close: point.close, volume: vol?.value ?? null })
      } else {
        setLegend(null)
      }
    })

    seriesRef.current = { chart, candleSeries, volumeSeries, maFast, maSlow }

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
    s.maFast.setData(sma(candles, MA_FAST_PERIOD))
    s.maSlow.setData(sma(candles, MA_SLOW_PERIOD))
    s.chart.timeScale().fitContent()

    const last = data[data.length - 1]
    setLegend({ open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume ?? null })
  }, [data])

  const first = data?.[0]
  const last = data?.[data.length - 1]
  const changeAbs = last && first ? last.close - first.open : 0
  const changePct = first?.open ? (changeAbs / first.open) * 100 : 0
  const isUp = changeAbs >= 0

  return (
    <div style={{ position: 'relative', background: BG, borderRadius: 10, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 12,
          right: 76,
          zIndex: 2,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          color: '#cbd3e1',
          lineHeight: 1.7,
          pointerEvents: 'none',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        }}
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {symbol && <strong style={{ color: '#fff' }}>{symbol}</strong>}
          {intervalLabel && <span style={{ color: '#6b7280' }}>{intervalLabel}</span>}
          {(first && last) && (
            <span style={{ color: isUp ? UP : DOWN }}>
              {isUp ? '+' : ''}
              {usd(changeAbs)} ({isUp ? '+' : ''}
              {changePct.toFixed(2)}%)
            </span>
          )}
        </div>
        {legend && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {(() => {
              const c = legend.close >= legend.open ? UP : DOWN
              return (
                <>
                  <span>
                    O <b style={{ color: c }}>{usd(legend.open)}</b>
                  </span>
                  <span>
                    H <b style={{ color: c }}>{usd(legend.high)}</b>
                  </span>
                  <span>
                    L <b style={{ color: c }}>{usd(legend.low)}</b>
                  </span>
                  <span>
                    C <b style={{ color: c }}>{usd(legend.close)}</b>
                  </span>
                  {legend.volume != null && (
                    <span>
                      Vol <b style={{ color: TEXT }}>{compact(legend.volume)}</b>
                    </span>
                  )}
                </>
              )
            })()}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, fontSize: 10.5, marginTop: 2 }}>
          <span style={{ color: MA_FAST_COLOR }}>● MA {MA_FAST_PERIOD}</span>
          <span style={{ color: MA_SLOW_COLOR }}>● MA {MA_SLOW_PERIOD}</span>
        </div>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: 420 }} />
    </div>
  )
}
