import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { num } from '../lib/format'

// "17 August 2026, 06:35 PM" style stamp used on the slip.
export const fmtSlipDate = (t) => {
  const d = new Date(t)
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${date}, ${time}`
}

// "DEP-000012" / "WD-000012" style request reference.
export const slipRef = (prefix, id) => `${prefix}-` + String(id).padStart(6, '0')

function SlipStatusIcon({ status }) {
  if (status === 'completed') {
    return (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5 L10 17.5 L19 7" />
      </svg>
    )
  }
  if (status === 'failed') {
    return (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
        <path d="M6 6 L18 18 M18 6 L6 18" />
      </svg>
    )
  }
  return (
    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5 V12 L15 14" />
    </svg>
  )
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Reject' },
]

// Pending / Completed / Reject segmented picker used next to the slip.
export function SlipStatusPicker({ value, onChange }) {
  return (
    <div className="status-seg" role="radiogroup" aria-label="Status">
      {STATUS_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={'status-seg-btn status-seg-' + o.value + (value === o.value ? ' active' : '')}
          onClick={() => onChange(o.value)}
        >
          <span className="status-seg-dot" />
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Receipt-style summary of a deposit/withdraw request, with a PNG download.
// rows: [label, value, mono?][]
export default function TransactionSlip({ status, amount, currency, from, to, badge, rows, fileName }) {
  const slipEl = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  async function handleDownload() {
    if (!slipEl.current) return
    setDownloadError('')
    setDownloading(true)
    try {
      const dataUrl = await toPng(slipEl.current, { pixelRatio: 2, backgroundColor: '#f2f5f5', cacheBust: true })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = fileName
      link.click()
    } catch {
      setDownloadError('Could not create the slip image. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="dep-slip-wrap">
      <div className="dep-slip" ref={slipEl}>
        <div className="brand dep-slip-brand">
          <span className="brand-mark">
            <svg width="18" height="18" viewBox="0 0 32 32">
              <path
                d="M7 21 L13 13 L18 17 L25 8"
                fill="none"
                stroke="#2DD4BF"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="25" cy="8" r="2.5" fill="#F5B14C" />
            </svg>
          </span>
          <span className="brand-name">
            OnChain<span>Trade</span>
          </span>
        </div>

        <div className="dep-slip-card">
          <div className={'dep-slip-icon dep-slip-icon-' + status}>
            <SlipStatusIcon status={status} />
          </div>
          <div className="dep-slip-amount">
            {amount > 0 ? num(amount) : '—'} <span>{currency}</span>
          </div>
          <div className="dep-slip-parties">
            <strong>{from}</strong> to
            <br />
            <strong>{to}</strong>
          </div>
          {badge}

          <dl className="dep-slip-rows">
            {rows.map(([label, value, mono]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className={mono ? 'mono' : undefined}>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="dep-slip-footer">This is a system generated slip by OnChainTrade.</div>
        </div>
      </div>

      <button className="btn btn-primary dep-slip-download" onClick={handleDownload} disabled={downloading}>
        {downloading ? 'Preparing…' : 'Download slip'}
      </button>
      {downloadError && <div className="alert alert-error" style={{ marginTop: 10 }}>{downloadError}</div>}
    </div>
  )
}
