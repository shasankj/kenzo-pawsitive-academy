import { useEffect, useState } from 'react'
import { useToast } from '../toast'
import { ReasonDialog } from '../components/Dialogs'
import { api } from '../api'
import { useAuth } from '../auth'
import { useCatalog } from '../catalog'
import Page from '../components/Page'
import { CourseForm } from '../components/Forms'
import { Empty } from '../components/Art'
import { hueFor, subjectEmoji, fmtDay, fmtTime, toDate, timeRange } from '../util'
import { DoorOpen, Ban } from 'lucide-react'

export default function Studio() {
  const { user } = useAuth()
  const cat = useCatalog()
  const toast = useToast()
  const [mine, setMine] = useState(null)
  const [target, setTarget] = useState(null)

  // Courses this trainer is teaching (by teacher_id filter), refreshed when the catalog changes.
  useEffect(() => {
    api.courses({ teacher_id: user.user_id }).then((r) => setMine(r.courses || [])).catch(() => setMine([]))
  }, [user.user_id, cat.courses])

  async function cancel(reason) {
    const r = await api.cancelClass(target.class_id, reason)
    toast(`${r.message || 'Class cancelled'}${r.students_affected ? ` · ${r.students_affected} pup${r.students_affected === 1 ? '' : 's'} notified` : ''}`, 'info')
    await cat.refresh()
  }

  const myClasses = cat.upcoming.filter((c) => c.teacher?.teacher_id === user.user_id)

  return (
    <Page>
      <section className="hello">
        <div>
          <p className="eyebrow">Trainer studio</p>
          <h1>Hello, Coach {user.name.split(' ')[0]} <span className="wag">🎓</span></h1>
        </div>
        <div className="stats">
          <div><b>{mine?.length ?? '–'}</b><span>courses taught</span></div>
          <div><b>{myClasses.length}</b><span>upcoming classes</span></div>
        </div>
      </section>

      <CourseForm />

      <div className="results-head"><h2>Your upcoming classes</h2></div>
      {myClasses.length ? (
        <div className="mini-list">
          {myClasses.map((c) => {
            const d = toDate(c.start_time, c.date)
            return (
              <div key={c.class_id} className="mini-row" style={{ '--h': hueFor(c.course?.subject) }}>
                <span className="mini-emoji">{subjectEmoji(c.course?.subject)}</span>
                <div><strong>{c.course?.title}</strong><small>{fmtDay(d)} · {timeRange(c)}</small></div>
                <span className="meta-text"><DoorOpen size={15} /> {c.classroom?.room_name}</span>
                <button className="btn btn-ghost-danger btn-sm" onClick={() => setTarget(c)}><Ban size={14} /> Cancel</button>
              </div>
            )
          })}
        </div>
      ) : <Empty emoji="📆" title="No classes scheduled for you yet">Classes are scheduled by the Head Dogs. New courses you add show up in the catalog right away.</Empty>}
      <ReasonDialog
        open={!!target} onClose={() => setTarget(null)} emoji="🚫" title="Cancel this class?"
        body={target ? `${target.course?.title} · ${fmtDay(toDate(target.start_time, target.date))}, ${timeRange(target)}. Booked pups will lose their seats.` : ''}
        confirmLabel="Cancel class" onConfirm={cancel}
      />
    </Page>
  )
}
