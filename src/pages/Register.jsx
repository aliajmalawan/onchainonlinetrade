import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function handleSubmit() {
    setError('')
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || form.password.length < 8) {
      setError('Fill every field. Password must be at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      await register({ ...form, email: form.email.trim() })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="panel panel-pad auth-card">
        <div className="brand">
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
        <h1>Create your account</h1>
        <p className="sub">Start tracking your portfolio</p>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="name">Name</label>
          <div className="input-icon-wrap">
            <span className="input-icon"><UserIcon /></span>
            <input id="name" className="input" value={form.name} onChange={set('name')} placeholder="Your name" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <div className="input-icon-wrap">
            <span className="input-icon"><MailIcon /></span>
            <input id="email" className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="phone">Phone Number</label>
          <div className="input-icon-wrap">
            <span className="input-icon"><PhoneIcon /></span>
            <input id="phone" className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="+1 234 567 8900" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="input-icon-wrap">
            <span className="input-icon"><LockIcon /></span>
            <input
              id="password"
              className="input"
              type="password"
              value={form.password}
              onChange={set('password')}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="At least 8 characters"
            />
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSubmit} disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>

        <div className="auth-alt">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
