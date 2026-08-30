/* ============================================================
   api.js — CoinGecko public API wrapper.

   CoinGecko's public endpoints need NO API key. The free tier is
   rate-limited (roughly ~10-30 calls/min), so we cache responses
   in memory + localStorage with a short TTL to avoid hitting the
   limit while you develop. This is real, honest market data.
   Docs: https://www.coingecko.com/en/api/documentation
   ============================================================ */

const BASE = import.meta.env.VITE_API_BASE || 'https://api.coingecko.com/api/v3'

const memCache = new Map()

async function cachedGet(path, ttlMs) {
  const now = Date.now()
  const cacheKey = 'ct.cache.' + path

  // 1) in-memory
  const mem = memCache.get(path)
  if (mem && now - mem.at < ttlMs) return mem.data

  // 2) localStorage (survives refresh)
  let staleFallback = null
  try {
    const raw = localStorage.getItem(cacheKey)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (now - parsed.at < ttlMs) {
        memCache.set(path, parsed)
        return parsed.data
      }
      staleFallback = parsed.data // outside TTL, but still useful if the network call fails
    }
  } catch {
    /* ignore corrupt cache */
  }

  // 3) network
  try {
    const res = await fetch(BASE + path)
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error('Rate limited by CoinGecko. Wait a moment and retry.')
      }
      throw new Error(`Request failed (${res.status}).`)
    }
    const data = await res.json()
    const entry = { at: now, data }
    memCache.set(path, entry)
    try {
      localStorage.setItem(cacheKey, JSON.stringify(entry))
    } catch {
      /* storage full — ignore */
    }
    return data
  } catch (err) {
    // A transient rate-limit or network blip shouldn't break the UI if we
    // already have older data to show — fall back to it instead of throwing.
    if (staleFallback) return staleFallback
    throw err
  }
}

// Top coins by market cap, with 24h change + 7d sparkline.
// ttlMs lets a caller ask for fresher data than the 1-minute default —
// e.g. the trade timer polls with a short ttl so "Current price" actually moves.
//
// Always fetches (and caches) a single 100-coin page regardless of what a
// caller asks for, then slices client-side — so every page on the site shares
// ONE cached CoinGecko call instead of each perPage value hitting the API
// independently, which was exhausting the free-tier rate limit.
const MARKETS_PAGE_SIZE = 100

export function getMarkets({ perPage = 50, page = 1, ttlMs = 60_000 } = {}) {
  const path =
    `/coins/markets?vs_currency=usd&order=market_cap_desc` +
    `&per_page=${MARKETS_PAGE_SIZE}&page=${page}&sparkline=true&price_change_percentage=24h`
  return cachedGet(path, ttlMs).then((data) => data.slice(0, perPage))
}

// Price history for one coin (for the detail chart).
export function getMarketChart(coinId, days = 7) {
  const path = `/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
  return cachedGet(path, 120_000) // 2 min
}

// --- Binance public API — real-time data CoinGecko's free tier (which only
// snapshots every ~1-5 minutes) can't provide.
const BINANCE_BASE = 'https://api.binance.com/api/v3'

// Real-time last-traded price — used for the trade timer's "Current price",
// since CoinGecko's snapshot (above) only refreshes every ~5 minutes and
// can't show movement within a 30-300 second trade window.
export async function getBinancePrice(symbol) {
  const path = `${BINANCE_BASE}/ticker/price?symbol=${symbol.toUpperCase()}USDT`
  const res = await fetch(path)
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.price) {
    throw new Error(data?.msg || `Binance price request failed (${res.status}).`)
  }
  return parseFloat(data.price)
}

// Real minute-level candles for the trade page's own chart — CoinGecko's
// free tier only snapshots every ~5 minutes, so it can't serve 1m/5m
// windows; Binance's public klines endpoint needs no API key and allows
// cross-origin requests, so it's used just for these short ranges.
export const SHORT_CHART_RANGES = [
  { label: '1m', interval: '1m', limit: 60 },
  { label: '5m', interval: '5m', limit: 60 },
  { label: '15m', interval: '15m', limit: 60 },
  { label: '1h', interval: '1h', limit: 48 },
]

// symbol: a coin's ticker (e.g. "btc") — paired against USDT on Binance.
export async function getBinanceKlines(symbol, interval, limit = 60) {
  const path = `${BINANCE_BASE}/klines?symbol=${symbol.toUpperCase()}USDT&interval=${interval}&limit=${limit}`
  const res = await fetch(path)
  const data = await res.json().catch(() => null)

  if (!res.ok || !Array.isArray(data)) {
    if (data?.code === -1121) {
      throw new Error(`${symbol.toUpperCase()} isn't traded against USDT on Binance`) // fallback handled by caller
    }
    throw new Error(data?.msg || `Binance request failed (${res.status}).`)
  }
  // [openTime, open, high, low, close, volume, closeTime, ...]
  return data.map((k) => ({
    t: k[6],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }))
}

export async function getCoinChart(coin, interval, limit = 60) {
  try {
    return await getBinanceKlines(coin.symbol, interval, limit)
  } catch (err) {
    if (coin?.id) {
      try {
        const market = await getMarketChart(coin.id, 1)
        if (Array.isArray(market?.prices) && market.prices.length) {
          // CoinGecko's market_chart endpoint only gives a single price per
          // point (no OHLC) — degrade to flat candles rather than fail.
          return market.prices.slice(-limit).map((p) => ({ t: p[0], open: p[1], high: p[1], low: p[1], close: p[1], volume: 0 }))
        }
      } catch (fallbackError) {
        // ignore fallback failure and continue with original error below
      }
    }
    throw new Error(`Chart unavailable for ${coin?.symbol?.toUpperCase() || 'this coin'}. ${err.message}`)
  }
}

// Live 24hr stats (price, % change, high, volume) for a set of coin
// symbols, paired against USDT — used to make a coin list actually tick in
// real time, since CoinGecko's markets snapshot (above) only moves every
// ~1-5 minutes. Fetched one symbol per request (not Binance's batch
// `symbols=[...]` param): that endpoint fails the *entire* batch — with no
// CORS header on the error, so the browser can't even read why — the
// moment a single symbol has no USDT market, which happens often on a
// gainers/losers list full of volatile small-caps. A per-symbol request
// lets the rest still update live when one coin's pair doesn't exist.
export async function getBinance24hrTickers(symbols) {
  // USDT/USDT isn't a real trading pair — Tether's own row always shows
  // CoinGecko's ~$1 price instead, so skip a request that's guaranteed to
  // 400 rather than firing it and catching the failure every single poll.
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))].filter((s) => s !== 'USDT')
  const results = await Promise.allSettled(
    unique.map((symbol) =>
      fetch(`${BINANCE_BASE}/ticker/24hr?symbol=${symbol}USDT`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`${symbol} unavailable`))))
        .then((t) => [
          symbol,
          {
            price: parseFloat(t.lastPrice),
            changePct: parseFloat(t.priceChangePercent),
            high: parseFloat(t.highPrice),
            volume: parseFloat(t.quoteVolume),
          },
        ])
    )
  )
  const map = {}
  results.forEach((r) => {
    if (r.status === 'fulfilled') map[r.value[0]] = r.value[1]
  })
  return map
}

// Current simple prices for a set of coin ids (for portfolio valuation).
export function getSimplePrices(ids = []) {
  if (!ids.length) return Promise.resolve({})
  const path = `/simple/price?ids=${ids.join(',')}&vs_currencies=usd`
  return cachedGet(path, 60_000)
}
