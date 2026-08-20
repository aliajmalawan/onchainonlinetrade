# OnChainTrade — Portfolio Dashboard

An honest crypto **portfolio tracker** built with React + Vite. It shows real,
live market data from the free CoinGecko public API, lets a user track their own
holdings and see real profit/loss, and includes a proper **auth flow** and an
**admin panel** for user management.

Built as a learning project — clean structure you can open in VS Code and extend
with Claude Code.

> **What this is not:** it does *not* fake balances, simulate fake "profits," or
> impersonate any real exchange. All prices are genuine live data. The admin panel
> manages *accounts and roles* — it can't manufacture money. That distinction is
> the whole point: the same UI skills, none of the scam mechanics.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Run the dev server (opens http://localhost:5173)
npm run dev
```

Demo admin account (seeded automatically on first run):

- **Email:** `ghk171854@gmail.com`
- **Password:** `admin123`

Or click **Create one** on the login screen to register a normal user.

To build for production:

```bash
npm run build      # outputs to /dist
npm run preview    # preview the production build
```

---

## Tech stack

| Piece         | Choice                                   |
| ------------- | ---------------------------------------- |
| Framework     | React 18 + Vite                          |
| Routing       | react-router-dom v6                      |
| Charts        | recharts (detail chart) + inline SVG (sparklines) |
| Market data   | CoinGecko public API (no key needed)     |
| Persistence   | `localStorage` (mock — see note below)   |
| Styling       | Plain CSS with design tokens in `src/styles/global.css` |

---

## Project structure

```
src/
├─ main.jsx              # entry point
├─ App.jsx               # routes + guards
├─ styles/global.css     # all styling + design tokens (:root)
├─ lib/
│  ├─ api.js             # CoinGecko calls + TTL caching
│  ├─ storage.js         # localStorage "database" (users, session, portfolio)
│  └─ format.js          # currency / % / number formatters
├─ context/
│  └─ AuthContext.jsx    # login / register / logout + current user
├─ components/
│  ├─ Layout.jsx         # ticker + sidebar + content shell
│  ├─ Sidebar.jsx        # role-aware nav
│  ├─ TickerTape.jsx     # scrolling live price strip (signature element)
│  ├─ Guards.jsx         # ProtectedRoute + AdminRoute
│  ├─ CoinTable.jsx      # markets table
│  ├─ Sparkline.jsx      # tiny 7-day SVG chart
│  ├─ PriceChart.jsx     # recharts area chart
│  └─ StatCard.jsx       # stat tile
└─ pages/
   ├─ Login.jsx  Register.jsx
   ├─ Dashboard.jsx  Markets.jsx  CoinDetail.jsx  Portfolio.jsx
   └─ admin/
      ├─ AdminHome.jsx   # platform stats
      └─ Users.jsx       # change roles / delete users
```

---

## Important: the persistence layer is a mock

`src/lib/storage.js` stores users (with **plain-text passwords**) and portfolios
in the browser's `localStorage`. That is fine for a local demo with zero backend,
but **never ship it like this.**

For a real app, replace the functions in `storage.js` with calls to a real backend
— which is exactly where your PHP/MySQL skills fit:

- Store users in MySQL, hash passwords with `password_hash()` / verify with `password_verify()`.
- Issue a session or JWT on login instead of trusting the browser.
- Move portfolio CRUD to authenticated API endpoints.

The frontend is already organised so this swap only touches `lib/storage.js` and
`context/AuthContext.jsx` — the components don't care where the data comes from.

---

## Ideas to extend (good Claude Code tasks)

- Add a **watchlist** (star coins on the Markets page).
- Add a **pie chart** of portfolio allocation on the Dashboard (recharts `PieChart`).
- Add **pagination or infinite scroll** to Markets (CoinGecko `page` param).
- Add a **currency switch** (USD / PKR / EUR) — CoinGecko supports `vs_currency`.
- Wire a **PHP + MySQL backend** and swap out the localStorage mock.
- Add **transaction history** per holding (multiple buys, average cost).

---

## API notes

CoinGecko's free tier is rate-limited (~10–30 requests/min). This app caches
responses in memory + `localStorage` with a short TTL (`src/lib/api.js`) to stay
under the limit. If you hit a `429`, wait a minute. Data source and docs:
<https://www.coingecko.com/en/api/documentation>
# onchainonlinetrade
