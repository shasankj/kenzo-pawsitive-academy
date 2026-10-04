import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, DoorOpen, GraduationCap, Compass } from 'lucide-react'
import { useCatalog } from '../catalog'
import Page from '../components/Page'
import { Empty, Spinner } from '../components/Art'
import { fmtDay, fmtTime, hueFor, isCancelled, seatLabel, subjectEmoji, toDate } from '../util'

export default function MyBookings() {
  const { bookings, loading } = useCatalog()
  const [tab, setTab] = useState('upcoming')

  // One ticket per class, listing every seat held in it.
  const tickets = useMemo(() => {
    const m = new Map()
    bookings.bookings.forEach((b) => {
      const t = m.get(b.class_id) || { ...b, seats: [] }
      t.seats.push(b.seat)
      m.set(b.class_id, t)
    })
    const now = Date.now()
    const list = [...m.values()].map((t) => {
      const cancelled = isCancelled(t)
      return { ...t, cancelled, start: toDate(t.start_time), end: toDate(t.end_time), past: cancelled || toDate(t.end_time) < now }
    })
    return {
      upcoming: list.filter((t) => !t.past).sort((a, b) => a.start - b.start),
      past: list.filter((t) => t.past).sort((a, b) => b.start - a.start),
    }
  }, [bookings])

  const shown = tickets[tab]

  return (
    <Page>
      <section className="hello">
        <div>
          <p className="eyebrow">Your pack schedule</p>
          <h1>My bookings <span className="wag">🎟️</span></h1>
        </div>
        <div className="stats">
          <div><b>{tickets.upcoming.length}</b><span>upcoming</span></div>
          <div><b>{bookings.bookings.filter((b) => !isCancelled(b)).length}</b><span>seats booked</span></div>
          <div><b>{bookings.courses.length}</b><span>courses</span></div>
        </div>
      </section>

      {bookings.courses.length > 0 && (
        <div className="course-strip">
          {bookings.courses.map((c) => (
            <Link key={c.course_id} to={`/courses/${c.course_id}`} className="strip-item" style={{ '--h': hueFor(c.subject) }}>
              <span>{subjectEmoji(c.subject)}</span>
              <div><strong>{c.title}</strong><small>{c.classes_booked} {c.classes_booked === 1 ? 'class' : 'classes'} booked</small></div>
            </Link>
          ))}
        </div>
      )}

      <div className="tabs">
        {['upcoming', 'past'].map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'upcoming' ? 'Upcoming' : 'Past'} <i>{tickets[t].length}</i>
            {tab === t && <motion.span layoutId="tab-line" className="tab-line" />}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : shown.length ? (
        <div className="tickets">
          {shown.map((t, i) => (
            <motion.div key={t.class_id} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
              <Link to={`/courses/${t.course?.course_id}?class=${t.class_id}`} className={`ticket ${t.cancelled ? 'cancelled' : t.past ? 'past' : ''}`} style={{ '--h': hueFor(t.course?.subject) }}>
                <div className="ticket-stub">
                  <small>{fmtDay(t.start, { month: 'short' })}</small>
                  <b>{t.start?.getDate()}</b>
                  <small>{fmtDay(t.start, { weekday: 'short' })}</small>
                </div>
                <div className="ticket-main">
                  <span className="chip chip-soft">{subjectEmoji(t.course?.subject)} {t.course?.subject}</span>
                  <h3>{t.course?.title}</h3>
                  <div className="ticket-meta">
                    <span><Clock size={15} /> {fmtTime(t.start)} – {fmtTime(t.end)}</span>
                    <span><GraduationCap size={15} /> {t.teacher?.name}</span>
                    <span><DoorOpen size={15} /> {t.classroom?.room_name}</span>
                  </div>
                </div>
                <div className="ticket-seat">
                  <small>{t.seats.length > 1 ? 'Seats' : 'Seat'}</small>
                  <div>{t.seats.map((s) => <b key={s.seat_id}>{seatLabel(s.row, s.col)}</b>)}</div>
                  <em>{t.cancelled ? 'Cancelled' : t.past ? 'Attended' : t.status || 'Booked'}</em>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <Empty emoji={tab === 'upcoming' ? '🛋️' : '📚'} title={tab === 'upcoming' ? 'No classes on the calendar' : 'No past classes yet'}>
          {tab === 'upcoming' ? <>Time to fetch some learning. <Link to="/" className="link"><Compass size={14} /> Browse courses</Link></> : 'Your finished classes will show up here.'}
        </Empty>
      )}
    </Page>
  )
}
