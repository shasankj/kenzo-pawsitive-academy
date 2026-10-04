import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Armchair, DoorOpen, GraduationCap, Loader2, Ticket, Users, Clock, Ban } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { useCatalog } from '../catalog'
import { useToast } from '../toast'
import Page from '../components/Page'
import SeatMap from '../components/SeatMap'
import Confetti from '../components/Confetti'
import { ReasonDialog } from '../components/Dialogs'
import { Empty, Spinner } from '../components/Art'
import { classDay, fmtDay, hueFor, initials, seatLabel, subjectEmoji, timeRange, toDate } from '../util'

const MAX_SEATS = 6

export default function CourseDetail() {
  const { id } = useParams()
  const cat = useCatalog()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [cancelOpen, setCancelOpen] = useState(null) // 'class' | 'course' | null
  const [params, setParams] = useSearchParams()

  const course = cat.courses.find((c) => String(c.course_id) === id)
  const all = cat.classesByCourse.get(Number(id)) || []
  const fTeacher = params.get('teacher'), fRoom = params.get('room'), fDay = params.get('date')
  const filtered = !!(fTeacher || fRoom || fDay)
  const sessions = useMemo(
    () => all.filter((s) =>
      (!fTeacher || String(s.teacher?.teacher_id) === fTeacher) &&
      (!fRoom || String(s.classroom?.classroom_id) === fRoom) &&
      (!fDay || classDay(s) === fDay)),
    [all, fTeacher, fRoom, fDay],
  )
  const shown = filtered && sessions.length ? sessions : all

  const classId = params.get('class') || (shown.length === 1 ? String(shown[0].class_id) : '')
  const pickClass = (cid) => {
    const n = new URLSearchParams(params)
    n.set('class', String(cid))
    setParams(n, { replace: true })
  }
  const showAll = () => {
    const n = new URLSearchParams(params)
    ;['teacher', 'room', 'date'].forEach((k) => n.delete(k))
    setParams(n, { replace: true })
  }

  const [avail, setAvail] = useState(null)
  const [loadingSeats, setLoadingSeats] = useState(false)
  const [seatError, setSeatError] = useState('')
  const [picked, setPicked] = useState(() => new Map()) // seat_id -> seat
  const [booking, setBooking] = useState(false)
  const [party, setParty] = useState(false)
  const seatsRef = useRef(null)

  const loadSeats = useCallback(async (cid, silent) => {
    if (!silent) setLoadingSeats(true)
    try {
      const a = await api.availability(cid)
      setAvail(a)
      setSeatError('')
      // drop selections someone else just grabbed
      setPicked((prev) => {
        const free = new Map(a.seats.filter((s) => s.available).map((s) => [s.seat_id, s]))
        const keep = new Map([...prev].filter(([k]) => free.has(k)))
        if (silent && keep.size < prev.size) toast('Someone snagged a seat you picked — pick another!', 'info')
        return keep
      })
    } catch (e) {
      if (!silent) setSeatError(e.message)
    } finally {
      if (!silent) setLoadingSeats(false)
    }
  }, [toast])

  useEffect(() => {
    setAvail(null)
    setPicked(new Map())
    if (!classId) return
    loadSeats(classId)
    const t = setInterval(() => loadSeats(classId, true), 15000)
    return () => clearInterval(t)
  }, [classId, loadSeats])

  useEffect(() => {
    if (classId && params.get('class') && seatsRef.current) {
      seatsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [classId]) // eslint-disable-line react-hooks/exhaustive-deps

  const myIds = useMemo(
    () => new Set((cat.mySeatsByClass.get(Number(classId)) || []).map((s) => s?.seat_id)),
    [cat.mySeatsByClass, classId],
  )

  const toggle = (seat) =>
    setPicked((prev) => {
      const n = new Map(prev)
      if (n.has(seat.seat_id)) n.delete(seat.seat_id)
      else if (n.size >= MAX_SEATS) toast(`That's a lot of paws — max ${MAX_SEATS} seats per booking.`, 'info')
      else n.set(seat.seat_id, seat)
      return n
    })

  async function book() {
    setBooking(true)
    const ok = [], bad = []
    for (const seat of picked.values()) {
      try {
        await api.book(Number(classId), seat.row, seat.col)
        ok.push(seat)
      } catch (e) {
        bad.push({ seat, msg: e.message })
      }
    }
    setBooking(false)
    if (ok.length) {
      setParty(true)
      toast(`Booked ${ok.map((s) => seatLabel(s.row, s.col)).join(', ')} — see you in class! 🐾`)
    }
    bad.forEach((b) => toast(`Seat ${seatLabel(b.seat.row, b.seat.col)}: ${b.msg}`, 'error'))
    await Promise.all([loadSeats(classId, true), cat.refreshBookings()])
    setPicked(new Map())
  }

  if (cat.loading) return <Page><Spinner /></Page>
  if (!course) return <Page><Empty emoji="🐕" title="Course not found"><Link to="/" className="link">Back to all courses</Link></Empty></Page>

  const teachers = [...new Map(all.map((s) => [s.teacher?.teacher_id, s.teacher])).values()].filter(Boolean)
  const rooms = [...new Map(all.map((s) => [s.classroom?.classroom_id, s.classroom])).values()].filter(Boolean)
  const cls = avail?.class
  const ended = cls && (toDate(cls.end_time) || 0) < Date.now()
  const canCancelClass = !!cls && !ended && (user.role === 'ADMIN' || (user.role === 'TEACHER' && cls.teacher?.teacher_id === user.user_id))
  const canCancelCourse = user.role === 'ADMIN'

  async function cancelClass(reason) {
    const r = await api.cancelClass(Number(classId), reason)
    toast(`${r.message || 'Class cancelled'}${r.students_affected ? ` · ${r.students_affected} pup${r.students_affected === 1 ? '' : 's'} notified` : ''}`, 'info')
    const n = new URLSearchParams(params); n.delete('class'); setParams(n, { replace: true })
    await Promise.all([cat.refresh(), cat.refreshBookings()])
  }
  async function cancelCourse(reason) {
    const r = await api.cancelCourse(course.course_id, reason)
    toast(`${r.message || 'Course cancelled'} · ${r.classes_cancelled ?? 0} classes, ${r.students_affected ?? 0} pups affected`, 'info')
    await Promise.all([cat.refresh(), cat.refreshBookings()])
    navigate('/')
  }
  const pct = avail?.capacity ? Math.round((avail.booked_count / avail.capacity) * 100) : 0
  const pickedList = [...picked.values()].sort((a, b) => a.row - b.row || a.col - b.col)

  return (
    <Page>
      <Link to={`/${params.toString() ? '?' + [...params].filter(([k]) => k !== 'class').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&') : ''}`} className="back"><ArrowLeft size={18} /> All courses</Link>

      <section className="hero-course" style={{ '--h': hueFor(course.subject) }}>
        <div className="hero-emoji" aria-hidden="true">{subjectEmoji(course.subject)}</div>
        <div className="hero-text">
          <span className="chip chip-glass">{course.subject}</span>
          <h1>{course.title}</h1>
          <p>{course.description || 'No description yet — but we hear it’s a good one.'}</p>
          <div className="hero-facts">
            <div>
              <GraduationCap size={18} />
              <div className="stack">{teachers.map((t) => <i key={t.teacher_id} style={{ '--h': hueFor(t.name) }} title={t.name}>{initials(t.name)}</i>)}</div>
              <span>{teachers.length > 3 ? `${teachers.slice(0, 3).map((t) => t.name).join(', ')} +${teachers.length - 3}` : teachers.map((t) => t.name).join(', ') || 'Trainer TBA'}</span>
            </div>
            {canCancelCourse && (
              <button className="hero-danger" onClick={() => setCancelOpen('course')}><Ban size={16} /> Cancel course</button>
            )}
            <div title={rooms.map((r) => r.room_name).join(', ')}><DoorOpen size={18} /><span>{rooms.length > 2 ? `${rooms.length} classrooms` : rooms.map((r) => r.room_name).join(' · ') || 'Room TBA'}</span></div>
          </div>
        </div>
      </section>

      <section className="step">
        <header className="step-head">
          <span className="step-no">1</span>
          <div><h2>Pick a class</h2><p className="muted">{shown.length ? `${shown.length} upcoming ${shown.length === 1 ? 'session' : 'sessions'}` : 'Nothing scheduled yet'}</p></div>
          {filtered && sessions.length > 0 && sessions.length < all.length && <button className="link" onClick={showAll}>Showing filtered · show all {all.length}</button>}
        </header>

        {shown.length ? (
          <div className="sessions">
            {shown.map((s) => {
              const dt = toDate(s.start_time, s.date)
              const on = String(s.class_id) === classId
              const mineHere = cat.mySeatsByClass.get(s.class_id)?.length
              return (
                <button key={s.class_id} className={`session ${on ? 'on' : ''}`} onClick={() => pickClass(s.class_id)} aria-pressed={on}>
                  <div className="session-date"><small>{fmtDay(dt, { month: 'short' })}</small><b>{dt?.getDate()}</b><small>{fmtDay(dt, { weekday: 'short' })}</small></div>
                  <div className="session-info">
                    <strong><Clock size={14} /> {timeRange(s)}</strong>
                    <span><i className="mini-av" style={{ '--h': hueFor(s.teacher?.name) }}>{initials(s.teacher?.name)}</i>{s.teacher?.name}</span>
                    <span><DoorOpen size={14} /> {s.classroom?.room_name}</span>
                  </div>
                  {mineHere ? <em className="session-flag"><Ticket size={12} /> {mineHere}</em> : null}
                </button>
              )
            })}
          </div>
        ) : (
          <Empty emoji="📅" title="No classes scheduled yet">Check back soon — the trainers are still sharpening their pencils.</Empty>
        )}
      </section>

      {classId && (
        <section className="step" ref={seatsRef}>
          <header className="step-head">
            <span className="step-no">2</span>
            <div><h2>Choose your seats</h2><p className="muted">Tap a paw to pick it — up to {MAX_SEATS} seats.</p></div>
          </header>

          {seatError ? (
            <Empty emoji="🙀" title="Couldn't load the seating chart">{seatError} <button className="link" onClick={() => loadSeats(classId)}>Retry</button></Empty>
          ) : !avail || loadingSeats ? (
            <Spinner label="Loading seats" />
          ) : (
            <div className="seat-layout">
              <div className="seat-main">
                <SeatMap
                  key={avail.class?.class_id}
                  rows={avail.layout.total_rows}
                  cols={avail.layout.total_columns}
                  seats={avail.seats}
                  selected={new Set(picked.keys())}
                  mine={myIds}
                  onToggle={toggle}
                  disabled={booking || ended}
                />
              </div>

              <aside className="roominfo card-flat">
                <h3>{cls.classroom?.room_name} <small>Room {cls.classroom?.room_number}</small></h3>
                <ul className="facts">
                  <li><Clock size={16} /> {fmtDay(toDate(cls.start_time), { weekday: 'long', month: 'long', day: 'numeric' })}<br /><span className="muted">{timeRange(cls)}</span></li>
                  <li><GraduationCap size={16} /> {cls.teacher?.name}</li>
                  <li><Armchair size={16} /> {avail.layout.total_rows} rows × {avail.layout.total_columns} seats</li>
                  <li><Users size={16} /> Capacity {avail.capacity}</li>
                </ul>
                <div className="meter" role="img" aria-label={`${pct}% full`}>
                  <div className="meter-bar"><motion.i initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} className={pct > 85 ? 'hot' : ''} /></div>
                  <div className="meter-nums"><span><b>{avail.available_count}</b> free</span><span><b>{avail.booked_count}</b> taken</span></div>
                </div>
                {avail.available_count === 0 && <p className="note warn">Fully booked — this pack is full!</p>}
                {ended && <p className="note warn">This class has already finished.</p>}
                {canCancelClass && (
                  <button className="btn btn-ghost-danger btn-block-sm" onClick={() => setCancelOpen('class')}><Ban size={16} /> Cancel this class</button>
                )}
              </aside>
            </div>
          )}
        </section>
      )}

      <div className="bar-spacer" />
      <AnimatePresence>
        {pickedList.length > 0 && (
          <motion.div className="checkout" initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
            <div className="checkout-info">
              <small>{course.title} · {cls && fmtDay(toDate(cls.start_time))}</small>
              <div className="picked-chips">
                <AnimatePresence>
                  {pickedList.map((s) => (
                    <motion.button key={s.seat_id} layout initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="seat-chip" onClick={() => toggle(s)} title="Remove">
                      🐾 {seatLabel(s.row, s.col)} <span>×</span>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </div>
            <button className="btn btn-primary btn-lg" onClick={book} disabled={booking}>
              {booking ? <Loader2 className="spin" size={18} /> : <Ticket size={18} />}
              Book {pickedList.length} {pickedList.length === 1 ? 'seat' : 'seats'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <ReasonDialog
        open={cancelOpen === 'class'} onClose={() => setCancelOpen(null)} emoji="🚫" title="Cancel this class?"
        body={cls ? `${course.title} on ${fmtDay(toDate(cls.start_time))}, ${timeRange(cls)}. Booked pups will lose their seats.` : ''}
        confirmLabel="Cancel class" onConfirm={cancelClass}
      />
      <ReasonDialog
        open={cancelOpen === 'course'} onClose={() => setCancelOpen(null)} emoji="🛑" title={`Cancel “${course.title}”?`}
        body="Every upcoming class in this course will be cancelled and all booked seats released. This can't be undone."
        confirmLabel="Cancel course" onConfirm={cancelCourse}
      />
      {party && <Confetti onDone={() => setParty(false)} />}
    </Page>
  )
}
