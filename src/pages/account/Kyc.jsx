import { useState } from 'react'
import { apiSubmitKyc } from '../../lib/backend'
import { useAuth } from '../../context/AuthContext'

export default function Kyc() {
  const { user } = useAuth()
  const isVerified = user?.kycStatus === 'verify'
  const [idType, setIdType] = useState('')
  const [front, setFront] = useState(null)
  const [back, setBack] = useState(null)
  const [selfie, setSelfie] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function submit() {
    setMsg('')
    setBusy(true)
    if (!idType || !front || !back || !selfie) {
      setMsg('Please choose an ID type and upload all required files.')
      setBusy(false)
      return
    }

    try {
      await apiSubmitKyc({ idType, frontFile: front, backFile: back, selfieFile: selfie })
      setMsg('Submitted for verification')
      setFront(null); setBack(null); setSelfie(null)
    } catch (err) {
      setMsg(err.message)
    } finally { setBusy(false) }
  }

  function FileUploadField({ label, file, onChange, disabled }) {
    return (
      <div className="field file-field">
        <div className="field-label-row">
          <label>{label}</label>
          <span className="file-hint">{file ? file.name : 'No file selected'}</span>
        </div>
        <label className={'file-picker' + (disabled ? ' disabled' : '')}>
          <span>{file ? 'Change file' : 'Choose file'}</span>
          <input
            type="file"
            accept="image/*"
            disabled={disabled}
            onChange={(e) => onChange(e.target.files[0] ?? null)}
          />
        </label>
      </div>
    )
  }

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Account</div>
        <h1>Identity verification (KYC)</h1>
        <p>Submit documents to verify your account.</p>
      </div>

      {user?.kycStatus === 'verify' && (
        <div className="alert alert-success">
          <span>✓</span>
          <span>Your identity has been successfully verified.</span>
        </div>
      )}

      {(user?.kycStatus === 'unverify' || !user?.kycStatus) && (
        <div className="alert alert-warning">
          Your account is not verified yet. Please submit your documents below to get verified.
        </div>
      )}

      {user?.kycStatus === 'rejected' && (
        <div className="alert alert-error">
          Your identity verification was rejected. Please resubmit your documents below or contact support.
        </div>
      )}

      <div className="panel panel-pad mt-16">
        <div className="kyc-grid">
          <div className="field">
            <label>ID Document Type</label>
            <select className="input" value={idType} onChange={(e) => setIdType(e.target.value)} disabled={isVerified}>
              <option value="" disabled hidden>
                Choose document type
              </option>
              <option value="passport">Passport</option>
              <option value="national_id">National ID Card</option>
              <option value="driving_license">Driving License</option>
            </select>
          </div>

          <FileUploadField
            label="Upload Front of ID Card"
            file={front}
            onChange={setFront}
            disabled={isVerified}
          />

          <FileUploadField
            label="Upload Back of ID Card"
            file={back}
            onChange={setBack}
            disabled={isVerified}
          />

          <FileUploadField
            label="Selfie with ID Document"
            file={selfie}
            onChange={setSelfie}
            disabled={isVerified}
          />
        </div>

        {msg && <div className="alert" style={{ marginBottom: 12 }}>{msg}</div>}

        <div style={{ textAlign: 'center' }}>
          <button className="btn btn-primary" onClick={submit} disabled={busy || isVerified}>
            {busy ? 'Submitting…' : 'Submit Documents'}
          </button>
        </div>
      </div>
    </div>
  )
}

const STEPS = [
  { title: 'Select ID type', description: "Passport, national ID, or driver's license" },
  { title: 'Upload documents', description: 'Front & back of the ID document' },
  { title: 'Selfie with ID', description: 'A photo holding the document, to match the face to the ID' },
]
