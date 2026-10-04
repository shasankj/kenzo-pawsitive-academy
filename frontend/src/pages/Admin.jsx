import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X, Inbox, UserPlus, GraduationCap, BookPlus, Building2, Loader2, RefreshCw, UserCog } from 'lucide-react'
import { api } from '../api'
import { useCatalog } from '../catalog'
import { useToast } from '../toast'
import Page from '../components/Page'
import { CourseForm, UserForm, ClassroomForm } from '../components/Forms'
import ManageUsers from '../components/ManageUsers'
import { Empty, Spinner } from '../components/Art'
import { ROLE_LABEL, fmtDay, hueFor, initials, toDate } from '../util'

const TABS = [
  { id: 'pending', label: 'Pending signups', icon: Inbox },
  { id: 'teacher', label: 'Add trainer', icon: GraduationCap },
  { id: 'student', label: 'Add pup', icon: UserPlus },
  { id: 'course', label: 'Add course', icon: BookPlus },
  { id: 'room', label: 'Add classroom', icon: Building2 },
  { id: 'users', label: 'Manage users', icon: UserCog },
]

function Pending({ onCount }) {
  const toast = useToast()
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await api.pendingSignups()
      setList(r.pending || [])
      onCount(r.count ?? (r.pending || []).length)
    } catch (e) { setError(e.message); setList([]) }
  }, [onCount])
  useEffect(() => { load() }, [load])

  async function review(u, decision) {
    setBusyId(u.user_id)
    try {
      await api.reviewSignup(u.user_id, decision)
      setList((l) => { const n = l.filter((x) => x.user_id !== u.user_id); onCount(n.length); return n })
      toast(decision === 'APPROVE' ? `${u.name} is in the pack! 🎉` : `${u.name}'s application was declined.`, decision === 'APPROVE' ? 'success' : 'info')
    } catch (e) { toast(e.message, 'error') }
    finally { setBusyId(null) }
  }

  if (!list) return <Spinner />
  return (
    <div>
      <div className="results-head">
        <h2>Waiting at the gate</h2>
        <button className="link" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>
      {error && <div className="form-error">{error}</div>}
      {list.length ? (
        <div className="grid slim">
          <AnimatePresence>
            {list.map((u) => (
              <motion.div key={u.user_id} layout className="card-flat applicant" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 80, scale: 0.9 }}>
                <div className="avatar big" style={{ '--h': hueFor(u.name) }}>{initials(u.name)}</div>
                <div className="applicant-info">
                  <strong>{u.name}</strong>
                  <span>{u.email}</span>
                  <div><span className={`role role-${String(u.role).toLowerCase()}`}>{ROLE_LABEL[String(u.role).toUpperCase()] || u.role}</span> <small className="muted">applied {fmtDay(toDate(u.created_at), { month: 'short', day: 'numeric' })}</small></div>
                </div>
                <div className="applicant-actions">
                  <button className="btn btn-ok" disabled={busyId === u.user_id} onClick={() => review(u, 'APPROVE')}>{busyId === u.user_id ? <Loader2 className="spin" size={16} /> : <Check size={16} />} Approve</button>
                  <button className="btn btn-ghost-danger" disabled={busyId === u.user_id} onClick={() => review(u, 'REJECT')}><X size={16} /> Reject</button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : <Empty emoji="🎉" title="All caught up">No one is waiting to join. Enjoy the quiet.</Empty>}
    </div>
  )
}

export default function Admin() {
  const cat = useCatalog()
  const [tab, setTab] = useState('pending')
  const [pending, setPending] = useState(null)
  const onCount = useCallback((n) => setPending(n), [])

  // Learn the badge count up front even if the pending tab isn't open.
  useEffect(() => { api.pendingSignups().then((r) => setPending(r.count ?? r.pending?.length ?? 0)).catch(() => {}) }, [])

  return (
    <Page>
      <section className="hello">
        <div>
          <p className="eyebrow">Head Dog HQ</p>
          <h1>Run the academy <span className="wag">👑</span></h1>
        </div>
        <div className="stats">
          <div><b>{pending ?? '–'}</b><span>pending</span></div>
          <div><b>{cat.teachers.length}</b><span>trainers</span></div>
          <div><b>{cat.courses.length}</b><span>courses</span></div>
          <div><b>{cat.classrooms.length}</b><span>rooms</span></div>
        </div>
      </section>

      <div className="tabs scroll">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <Icon size={16} /> {label}
            {id === 'pending' && pending > 0 && <i className="alert">{pending}</i>}
            {tab === id && <motion.span layoutId="tab-line" className="tab-line" />}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {tab === 'pending' && <Pending onCount={onCount} />}
          {tab === 'teacher' && <UserForm kind="teacher" />}
          {tab === 'student' && <UserForm kind="student" />}
          {tab === 'course' && <CourseForm />}
          {tab === 'room' && <ClassroomForm />}
          {tab === 'users' && <ManageUsers />}
        </motion.div>
      </AnimatePresence>
    </Page>
  )
}
