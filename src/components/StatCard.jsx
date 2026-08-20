import { Link } from 'react-router-dom'

export default function StatCard({ label, value, valueClass, delta, deltaClass, to, icon, accent }) {
  const content = (
    <>
      {icon && <span className={'stat-icon stat-icon-' + accent}>{icon}</span>}
      <div className="label">{label}</div>
      <div className={'value ' + (valueClass || '')}>{value}</div>
      {delta != null && <div className={'delta ' + (deltaClass || '')}>{delta}</div>}
    </>
  )

  if (to) {
    return (
      <Link to={to} className="stat stat-clickable">
        {content}
      </Link>
    )
  }

  return <div className="stat">{content}</div>
}
