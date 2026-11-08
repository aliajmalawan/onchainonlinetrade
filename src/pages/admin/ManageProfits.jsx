import { useEffect, useState } from 'react'
import { apiAdminGetTradeTimers, apiAdminUpdateTradeTimers } from '../../lib/backend'
import { num } from '../../lib/format'

const EXAMPLE_STAKE = 100

// Profit rates are whole percentages from 0 to 100.
const isValidPercent = (v) => v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 100

const timerLabel = (s) => (s < 60 ? `${s} seconds` : `${s} seconds (${s / 60} min)`)

export default function ManageProfits() {
  const [timers, setTimers] = useState(null) // saved [{ duration, percent }]
  const [draft, setDraft] = useState({}) // duration -> input text
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function load(list) {
    setTimers(list)
    setDraft(Object.fromEntries(list.map((t) => [t.duration, String(t.percent)])))
  }

  useEffect(() => {
    apiAdminGetTradeTimers()
      .then(load)
      .catch((err) => {
        setTimers([])
        setError(err.message)
      })
  }, [])

  const changed = (timers ?? []).filter((t) => parseFloat(draft[t.duration]) !== t.percent)
  const invalid = (timers ?? []).find((t) => !isValidPercent(draft[t.duration]))

  async function save() {
    setError('')
    setSaved(false)
    if (invalid) return setError(`Enter a whole number from 0 to 100% for the ${invalid.duration}s timer.`)
    setBusy(true)
    try {
      const updated = await apiAdminUpdateTradeTimers(
        changed.map((t) => ({ duration: t.duration, percent: Number(draft[t.duration]) }))
      )
      load(updated)
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Admin</div>
        <h1>Manage Profits</h1>
        <p>
          The profit each Trade duration timer pays on a winning trade. Changes apply to every trade settled after you
          save.
        </p>
      </div>

      <div className="panel panel-pad">
        {timers === null && <div className="muted">Loading…</div>}
        {timers?.length === 0 && !error && <div className="muted">No trade timers found.</div>}

        {timers?.length > 0 && (
          <div className="profit-rows">
            {timers.map((t) => {
              const value = draft[t.duration] ?? ''
              const pctNum = Number(value)
              const valid = isValidPercent(value)
              return (
                <div key={t.duration} className="profit-row">
                  <div className="profit-row-timer">
                    <div className="profit-row-title">{timerLabel(t.duration)}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Currently {t.percent}% ·{' '}
                      {valid
                        ? `${EXAMPLE_STAKE} USDT trade → +${num((EXAMPLE_STAKE * pctNum) / 100)} USDT profit`
                        : 'Enter a whole number from 0 to 100'}
                    </div>
                  </div>
                  <div className={'profit-row-input' + (valid ? '' : ' has-error')}>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      inputMode="numeric"
                      aria-label={`Profit % for the ${t.duration} second timer`}
                      value={value}
                      onChange={(e) => {
                        setSaved(false)
                        setDraft((d) => ({ ...d, [t.duration]: e.target.value }))
                      }}
                    />
                    <span className="profit-row-suffix">%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {error && <div className="alert alert-error" style={{ marginTop: 14 }}>{error}</div>}
        {saved && <div className="alert alert-success" style={{ marginTop: 14 }}>Profit rates saved.</div>}

        {timers?.length > 0 && (
          <div className="profit-actions">
            <button className="btn btn-primary" onClick={save} disabled={busy || changed.length === 0}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            {changed.length > 0 && !busy && (
              <span className="muted" style={{ fontSize: 13 }}>
                {changed.length} unsaved {changed.length === 1 ? 'change' : 'changes'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
