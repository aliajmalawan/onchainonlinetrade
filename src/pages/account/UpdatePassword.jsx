import { useState } from 'react'
import { apiUpdatePassword } from '../../lib/backend'

export default function UpdatePassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    setError('')
    setSuccess('')
    if (newPassword.length < 8 || newPassword.length > 20) {
      return setError('New password must be between 8 and 20 characters.')
    }
    if (newPassword !== confirmPassword) return setError('New password and confirmation do not match.')

    setBusy(true)
    try {
      await apiUpdatePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Password updated.')
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
        <h1>Update password</h1>
        <p>Enter your current password to set a new one.</p>
      </div>

      <div className="panel panel-pad" style={{ maxWidth: 420 }}>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-info">{success}</div>}

        <div className="field">
          <label htmlFor="current">Current password</label>
          <input
            id="current"
            className="input"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="next">New password</label>
          <input
            id="next"
            className="input"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="8–20 characters"
          />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirm new password</label>
          <input
            id="confirm"
            className="input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <div style={{ textAlign: 'center' }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={busy}>
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </div>
      </div>
    </div>
  )
}
