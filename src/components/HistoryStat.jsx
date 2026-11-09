// Summary card for the account Deposit/Withdraw history pages. Lay two out
// in a `.dh-stats` grid. value null = still loading.

export const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.5 2.5L16 9.5" />
  </svg>
)

export const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

export default function HistoryStat({ icon, label, value, unit, hint, tone }) {
  return (
    <div className={'dh-stat' + (tone ? ' dh-stat-' + tone : '')}>
      <div className="dh-stat-head">
        <span className="dh-stat-label">{label}</span>
        <span className="dh-stat-icon">{icon}</span>
      </div>
      <div className="dh-stat-value">
        {value === null ? '—' : value}
        {value !== null && unit && <span className="dh-stat-unit">{unit}</span>}
      </div>
      <div className="dh-stat-hint">{hint}</div>
    </div>
  )
}
