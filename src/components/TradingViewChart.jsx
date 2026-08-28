// Embeds TradingView's own free "Advanced Chart" widget — the real
// tradingview.com chart, not a lookalike — via their public widgetembed
// endpoint. Its own toolbar covers intervals and indicators, and its
// footer carries TradingView's own attribution, so nothing extra is drawn
// around it here.
export default function TradingViewChart({ symbol }) {
  const tvSymbol = `BINANCE:${symbol.toUpperCase()}USDT`
  const params = new URLSearchParams({
    symbol: tvSymbol,
    interval: '60',
    hidesidetoolbar: '1',
    hidetoptoolbar: '0',
    symboledit: '0',
    saveimage: '0',
    toolbarbg: '131722',
    theme: 'dark',
    style: '1',
    timezone: 'Etc/UTC',
    withdateranges: '1',
    locale: 'en',
  })

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #232733' }}>
      <iframe
        key={tvSymbol}
        src={`https://s.tradingview.com/widgetembed/?${params.toString()}`}
        title="TradingView chart"
        style={{ width: '100%', height: 480, display: 'block' }}
        frameBorder="0"
        scrolling="no"
        allow="unload"
      />
    </div>
  )
}
