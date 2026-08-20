import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getMarkets } from '../../lib/api'
import ManageHoldingsPanel from '../../components/ManageHoldingsPanel'

export default function UpdateAccount() {
  const { user, updateAccount } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [coins, setCoins] = useState([])
  const [holdingsMessage, setHoldingsMessage] = useState('')

  useEffect(() => {
    if (!isAdmin) return
    getMarkets({ perPage: 100 }).then(setCoins).catch(() => {})
  }, [isAdmin])

  const fmtDate = (t) =>
    t ? new Date(t).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

  const initials = (n) =>
    (n || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'

  async function handleSubmit() {
    setError('')
    setSuccess('')
    if (!name.trim() || !email.trim() || !phone.trim()) return setError('Name, email and phone number are required.')

    setBusy(true)
    try {
      await updateAccount(name.trim(), email.trim(), phone.trim())
      setSuccess('Account updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Account</div>
        <h1>{isAdmin ? 'Profile' : 'Update account'}</h1>
        <p>{isAdmin ? 'Super admin account details.' : 'Change your display name, email or phone number.'}</p>
      </div>

      {isAdmin ? (
        <>
          <div className="admin-profile-grid">
            <div className="panel panel-pad admin-profile-summary">
              <span className="avatar-circle" style={{ width: 56, height: 56, fontSize: 20 }}>
                {initials(user.name)}
              </span>
              <div>
                <h2 style={{ fontSize: 18, marginBottom: 4 }}>{user.name}</h2>
                <div className="muted" style={{ fontSize: 13, wordBreak: 'break-all' }}>{user.email}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                  <span className="badge badge-admin">Super Admin</span>
                  <span className="muted mono" style={{ fontSize: 12 }}>Joined {fmtDate(user.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="panel panel-pad">
              {error && <div className="alert alert-error">{error}</div>}
              {success && <div className="alert alert-info">{success}</div>}

              <div className="field">
                <label htmlFor="name">Name</label>
                <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field mb-0">
                <label htmlFor="email">Email</label>
                <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="field mb-0" style={{ marginTop: 16 }}>
                <label htmlFor="phone">Phone Number</label>
                <input id="phone" className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 234 567 8900" />
              </div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleSubmit} disabled={busy}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>

          <div className="panel panel-pad" style={{ marginTop: 16 }}>
            {holdingsMessage && <div className="alert alert-info">{holdingsMessage}</div>}
            <ManageHoldingsPanel user={user} coins={coins} onModeChanged={setHoldingsMessage} />
          </div>
        </>
      ) : (
        <div className="panel panel-pad" style={{ maxWidth: 420 }}>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-info">{success}</div>}

          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone Number</label>
            <input id="phone" className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 234 567 8900" />
          </div>

          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
