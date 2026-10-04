import { useState } from 'react'
import { PauseCircle, Trash2, RotateCcw, UserCog, CheckCircle2 } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { useCatalog } from '../catalog'
import { useToast } from '../toast'
import { ReasonDialog } from './Dialogs'
import { hueFor, initials } from '../util'

const ACTIONS = {
  suspend: { icon: PauseCircle, emoji: '⏸️', label: 'Suspend', hint: 'Temporarily lock an account', danger: true },
  remove: { icon: Trash2, emoji: '🗑️', label: 'Remove', hint: 'Remove an account for good', danger: true },
  reactivate: { icon: RotateCcw, emoji: '♻️', label: 'Reactivate', hint: 'Let a suspended user back in', danger: false },
}

export default function ManageUsers() {
  const { user: me } = useAuth()
  const { teachers, refresh, refreshBookings } = useCatalog()
  const toast = useToast()
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState('suspend')
  const [open, setOpen] = useState(false)
  const [cancelClasses, setCancelClasses] = useState(false)
  const [releaseBookings, setReleaseBookings] = useState(false)
  const [outcome, setOutcome] = useState(null)

  const id = Number(userId)
  const valid = Number.isInteger(id) && id >= 1
  const isMe = valid && id === me.user_id
  const picked = teachers.find((t) => t.teacher_id === id)
  const A = ACTIONS[action]

  async function run(reason) {
    let r
    if (action === 'suspend') r = await api.suspendUser({ user_id: id, reason, cancel_classes: cancelClasses, release_bookings: releaseBookings })
    else if (action === 'remove') r = await api.removeUser({ user_id: id, reason, cancel_classes: cancelClasses })
    else r = await api.reactivateUser(id)
    const u = r.user || {}
    setOutcome({ ...r, action })
    toast(`${u.name || `User #${id}`} is now ${String(u.status || (action === 'remove' ? 'removed' : 'updated')).toLowerCase()}`, action === 'reactivate' ? 'success' : 'info')
    await Promise.all([refresh(), refreshBookings()])
  }

  const openDialog = () => { setCancelClasses(false); setReleaseBookings(false); setOpen(true) }

  return (
    <div className="form-split">
      <div className="form-card">
        <h3>Manage a user</h3>
        <p className="muted tiny" style={{ marginBottom: '1rem' }}>Pick a trainer below, or type any user ID (pending signups and newly added accounts show their ID on approval).</p>

        <label className="field">
          <span>User ID</span>
          <div className="input"><UserCog size={18} /><input type="number" min={1} placeholder="e.g. 7" value={userId} onChange={(e) => setUserId(e.target.value)} /></div>
        </label>

        {teachers.length > 0 && (
          <div className="field">
            <span>Trainers</span>
            <div className="chips wrap">
              {teachers.map((t) => (
                <button type="button" key={t.teacher_id} className={`pill ${id === t.teacher_id ? 'on' : ''}`} onClick={() => setUserId(String(t.teacher_id))}>
                  <i className="mini-av" style={{ '--h': hueFor(t.name) }}>{initials(t.name)}</i>{t.name} <small className="muted">#{t.teacher_id}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <span>Action</span>
          <div className="choice three">
            {Object.entries(ACTIONS).map(([k, a]) => (
              <button type="button" key={k} className={action === k ? 'on' : ''} onClick={() => setAction(k)}>
                <em>{a.emoji}</em><strong>{a.label}</strong><small>{a.hint}</small>
              </button>
            ))}
          </div>
        </div>

        {isMe && <div className="form-error">That's you, Head Dog — you can't {action} your own account.</div>}
        <button className={`btn ${A.danger ? 'btn-danger' : 'btn-primary'}`} disabled={!valid || isMe} onClick={openDialog}>
          <A.icon size={18} /> {A.label} {picked ? picked.name : valid ? `user #${id}` : 'user'}
        </button>
      </div>

      <div className="preview">
        <small className="eyebrow">Last action</small>
        {outcome ? (
          <div className="card-flat outcome">
            <CheckCircle2 size={28} />
            <strong>{outcome.user?.name || `User #${id}`}</strong>
            <span className="muted">{outcome.user?.email}</span>
            <div className="outcome-tags">
              {outcome.user?.role && <span className={`role role-${String(outcome.user.role).toLowerCase()}`}>{outcome.user.role}</span>}
              {outcome.user?.status && <span className="chip chip-soft" style={{ '--h': outcome.action === 'reactivate' ? 150 : 25 }}>{outcome.user.status}</span>}
            </div>
            {outcome.classes_cancelled != null && <p><b>{outcome.classes_cancelled}</b> classes cancelled</p>}
            {outcome.bookings_released != null && <p><b>{outcome.bookings_released}</b> bookings released</p>}
          </div>
        ) : <div className="card-flat outcome muted">Nothing yet. Actions you take will be summarised here.</div>}
      </div>

      <ReasonDialog
        open={open} onClose={() => setOpen(false)} emoji={A.emoji}
        title={`${A.label} ${picked ? picked.name : `user #${id}`}?`}
        body={action === 'reactivate' ? 'Their account will be active again and they can log in.' : action === 'suspend' ? 'They won’t be able to log in until you reactivate them.' : 'This permanently removes their account.'}
        confirmLabel={A.label} danger={A.danger} askReason={action !== 'reactivate'} onConfirm={run}
      >
        {action !== 'reactivate' && (
          <div className="checks">
            <label className="check"><input type="checkbox" checked={cancelClasses} onChange={(e) => setCancelClasses(e.target.checked)} /><span>Cancel their classes <small>(for trainers)</small></span></label>
            {action === 'suspend' && <label className="check"><input type="checkbox" checked={releaseBookings} onChange={(e) => setReleaseBookings(e.target.checked)} /><span>Release their bookings <small>(for pups)</small></span></label>}
          </div>
        )}
      </ReasonDialog>
    </div>
  )
}
