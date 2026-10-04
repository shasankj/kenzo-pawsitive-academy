import { useState } from 'react'
import { Loader2, Plus, Mail, Lock, User } from 'lucide-react'
import { api } from '../api'
import { useToast } from '../toast'
import { useCatalog } from '../catalog'
import { hueFor, subjectEmoji } from '../util'
import { Paw } from './Art'

function useSubmit(fn, ok, reset) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return {
    busy, error,
    onSubmit: async (e) => {
      e.preventDefault()
      setBusy(true); setError('')
      try {
        const r = await fn()
        toast(ok(r))
        reset()
      } catch (err) {
        setError(err.message)
      } finally {
        setBusy(false)
      }
    },
  }
}

const Submit = ({ busy, children }) => (
  <button className="btn btn-primary" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}{children}</button>
)
const Err = ({ error }) => (error ? <div className="form-error" role="alert">{error}</div> : null)

export function CourseForm() {
  const { refresh } = useCatalog()
  const blank = { title: '', subject: '', description: '' }
  const [f, setF] = useState(blank)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const s = useSubmit(
    async () => { const r = await api.addCourse({ ...f, title: f.title.trim(), subject: f.subject.trim() }); await refresh(); return r },
    (r) => `“${r.course?.title || f.title}” is live in the course catalog 🎓`,
    () => setF(blank),
  )
  return (
    <div className="form-split">
      <form onSubmit={s.onSubmit} className="form-card">
        <h3>Create a course</h3>
        <label className="field"><span>Title</span><div className="input"><input required maxLength={150} placeholder="Advanced Zoomies" value={f.title} onChange={set('title')} /></div></label>
        <label className="field"><span>Subject</span><div className="input"><input required maxLength={80} placeholder="Sports, Art, Psychology…" value={f.subject} onChange={set('subject')} /></div></label>
        <label className="field"><span>Description <small>{f.description.length}/2000</small></span><div className="input"><textarea rows={5} maxLength={2000} placeholder="What will the pups learn?" value={f.description} onChange={set('description')} /></div></label>
        <Err error={s.error} />
        <Submit busy={s.busy}>Add course</Submit>
      </form>
      <div className="preview">
        <small className="eyebrow">Live preview</small>
        <div className="card course" style={{ '--h': hueFor(f.subject || 'x') }}>
          <div className="course-top"><span className="chip chip-glass">{f.subject || 'Subject'}</span><div className="course-emoji">{subjectEmoji(f.subject)}</div></div>
          <div className="course-body"><h3>{f.title || 'Your course title'}</h3><p className="clamp">{f.description || 'Your description will appear here.'}</p></div>
        </div>
      </div>
    </div>
  )
}

export function UserForm({ kind }) {
  const { refresh } = useCatalog()
  const blank = { name: '', email: '', password: '' }
  const [f, setF] = useState(blank)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const isTeacher = kind === 'teacher'
  const s = useSubmit(
    async () => { const r = await (isTeacher ? api.addTeacher : api.addStudent)({ ...f, name: f.name.trim(), email: f.email.trim() }); await refresh(); return r },
    (r) => `${r.user?.name || f.name} joined as ${isTeacher ? 'a trainer' : 'a pup'} 🐾`,
    () => setF(blank),
  )
  return (
    <form onSubmit={s.onSubmit} className="form-card narrow">
      <h3>{isTeacher ? 'Add a trainer' : 'Add a pup'}</h3>
      <p className="muted">Accounts created here are active straight away — no approval needed.</p>
      <label className="field"><span>Name</span><div className="input"><User size={18} /><input required maxLength={100} value={f.name} onChange={set('name')} /></div></label>
      <label className="field"><span>Email</span><div className="input"><Mail size={18} /><input required type="email" maxLength={255} value={f.email} onChange={set('email')} /></div></label>
      <label className="field"><span>Temporary password</span><div className="input"><Lock size={18} /><input required type="password" minLength={8} maxLength={128} placeholder="At least 8 characters" value={f.password} onChange={set('password')} autoComplete="new-password" /></div></label>
      <Err error={s.error} />
      <Submit busy={s.busy}>{isTeacher ? 'Add trainer' : 'Add pup'}</Submit>
    </form>
  )
}

export function ClassroomForm() {
  const { refresh } = useCatalog()
  const blank = { room_name: '', room_number: '', total_rows: 4, total_columns: 6 }
  const [f, setF] = useState(blank)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const rows = Math.min(50, Math.max(1, +f.total_rows || 1))
  const cols = Math.min(50, Math.max(1, +f.total_columns || 1))
  const s = useSubmit(
    async () => {
      const r = await api.addClassroom({ room_name: f.room_name.trim(), room_number: +f.room_number, total_rows: rows, total_columns: cols })
      await refresh(); return r
    },
    (r) => `${r.classroom?.room_name || f.room_name} is ready — ${rows * cols} seats 🪑`,
    () => setF(blank),
  )
  const seat = Math.max(8, Math.min(26, Math.floor(300 / cols)))
  return (
    <div className="form-split">
      <form onSubmit={s.onSubmit} className="form-card">
        <h3>Build a classroom</h3>
        <label className="field"><span>Room name</span><div className="input"><input required maxLength={100} placeholder="Corgi Corner" value={f.room_name} onChange={set('room_name')} /></div></label>
        <div className="two">
          <label className="field"><span>Room number</span><div className="input"><input required type="number" min={1} value={f.room_number} onChange={set('room_number')} /></div></label>
          <label className="field"><span>Rows (1–50)</span><div className="input"><input required type="number" min={1} max={50} value={f.total_rows} onChange={set('total_rows')} /></div></label>
          <label className="field"><span>Seats per row (1–50)</span><div className="input"><input required type="number" min={1} max={50} value={f.total_columns} onChange={set('total_columns')} /></div></label>
        </div>
        <Err error={s.error} />
        <Submit busy={s.busy}>Add classroom</Submit>
      </form>
      <div className="preview">
        <small className="eyebrow">Seating preview · {rows * cols} seats</small>
        <div className="mini-room">
          <div className="stage small"><span>Podium</span></div>
          <div className="mini-grid" style={{ gridTemplateColumns: `repeat(${cols}, ${seat}px)`, gap: Math.max(2, seat / 6) }}>
            {Array.from({ length: rows * cols }, (_, i) => <Paw key={i} size={seat} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
