import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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

export default function Login() {
  const { login, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const from = location.state?.from?.pathname || '/dashboard'

  async function handleSubmit() {
    setError('')
    setBusy(true)
    try {
      const found = await login(email.trim(), password)
      if (found.role === 'admin') {
        await logout()
        setError('Admin accounts must sign in from the admin panel.')
        return
      }
      navigate(from, { replace: true })
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
        <h1>Welcome back</h1>
        <p className="sub">Sign in to your dashboard</p>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <div className="input-icon-wrap">
            <span className="input-icon"><MailIcon /></span>
            <input
              id="email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="you@example.com"
            />
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="••••••••"
            />
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSubmit} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="auth-alt">
          No account? <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  )
}
