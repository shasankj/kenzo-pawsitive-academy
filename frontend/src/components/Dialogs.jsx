import { useEffect, useState } from 'react'
import { Loader2, Lock, KeyRound } from 'lucide-react'
import { api } from '../api'
import { useToast } from '../toast'
import Modal from './Modal'

// Generic "are you sure?" dialog with an optional reason box and extra controls (children).
export function ReasonDialog({ open, onClose, emoji = '⚠️', title, body, confirmLabel, danger = true, askReason = true, onConfirm, children }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (open) { setReason(''); setError(''); setBusy(false) } }, [open])

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await onConfirm(reason.trim())
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title} emoji={emoji}>
      <form onSubmit={submit}>
        {body && <p className="muted modal-body">{body}</p>}
        {askReason && (
          <label className="field">
            <span>Reason <small>{reason.length}/500 · optional</small></span>
            <div className="input"><textarea rows={3} maxLength={500} placeholder="Let everyone know why…" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          </label>
        )}
        {children}
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-soft" onClick={onClose} disabled={busy}>Never mind</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy}>
            {busy && <Loader2 className="spin" size={16} />} {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function ChangePasswordDialog({ open, onClose }) {
  const toast = useToast()
  const blank = { current: '', next: '', again: '' }
  const [f, setF] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  useEffect(() => { if (open) { setF(blank); setError('') } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (f.next !== f.again) return setError("The new passwords don't match.")
    if (f.next === f.current) return setError('Pick a new password that is different from the current one.')
    setBusy(true)
    try {
      const r = await api.changePassword(f.current, f.next)
      toast(r.message || 'Password updated — a fresh start! 🔑')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Change your password" emoji="🔑">
      <form onSubmit={submit}>
        <label className="field"><span>Current password</span><div className="input"><Lock size={18} /><input required type="password" autoComplete="current-password" value={f.current} onChange={set('current')} /></div></label>
        <label className="field"><span>New password</span><div className="input"><KeyRound size={18} /><input required type="password" minLength={8} maxLength={128} placeholder="At least 8 characters" autoComplete="new-password" value={f.next} onChange={set('next')} /></div></label>
        <label className="field"><span>Repeat new password</span><div className="input"><KeyRound size={18} /><input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={f.again} onChange={set('again')} /></div></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-soft" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy && <Loader2 className="spin" size={16} />} Update password</button>
        </div>
      </form>
    </Modal>
  )
}
