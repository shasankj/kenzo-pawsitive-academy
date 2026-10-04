import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, X, CalendarDays, GraduationCap, DoorOpen, Ticket, ArrowRight } from 'lucide-react'
import { useAuth } from '../auth'
import { useCatalog } from '../catalog'
import Page from '../components/Page'
import CourseCard from '../components/CourseCard'
import { Empty } from '../components/Art'
import { classDay, fmtDay, fmtTime, hueFor, initials, toDate } from '../util'

const greeting = () => {
  const h = new Date().getHours()
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Discover() {
  const { user } = useAuth()
  const cat = useCatalog()
  const [params, setParams] = useSearchParams()
  const teacher = params.get('teacher') || ''
  const room = params.get('room') || ''
  const day = params.get('date') || ''
  const q = params.get('q') || ''

  const setQuery = (v) => {
    const next = new URLSearchParams(params)
    if (v) next.set('q', v)
    else next.delete('q')
    setParams(next, { replace: true })
  }
  const setParam = (k, v) => {
    const next = new URLSearchParams(params)
    // clicking an active chip toggles it off
    if (!v || next.get(k) === v) next.delete(k)
    else next.set(k, v)
    setParams(next, { replace: true })
  }
  const clearAll = () => setParams({}, { replace: true })
  const filtered = teacher || room || day

  // Days that actually have classes (respecting the other filters) — more useful than an empty calendar.
  const days = useMemo(() => {
    const m = new Map()
    cat.upcoming
      .filter((c) => (!teacher || String(c.teacher?.teacher_id) === teacher) && (!room || String(c.classroom?.classroom_id) === room))
      .forEach((c) => m.set(classDay(c), (m.get(classDay(c)) || 0) + 1))
    return [...m.entries()].sort()
  }, [cat.upcoming, teacher, room])

  const rows = useMemo(() => {
    const matches = (s) =>
      (!teacher || String(s.teacher?.teacher_id) === teacher) &&
      (!room || String(s.classroom?.classroom_id) === room) &&
      (!day || classDay(s) === day)
    const needle = q.trim().toLowerCase()
    return cat.courses
      .filter((c) => !needle || `${c.title} ${c.subject} ${c.description}`.toLowerCase().includes(needle))
      .map((c) => ({ course: c, sessions: (cat.classesByCourse.get(c.course_id) || []).filter(matches) }))
      .filter((r) => !filtered || r.sessions.length)
      .sort((a, b) => Number(!!b.sessions.length) - Number(!!a.sessions.length))
  }, [cat.courses, cat.classesByCourse, teacher, room, day, q, filtered])

  const nextUp = useMemo(() => {
    const now = Date.now()
    return cat.activeBookings
      .filter((b) => toDate(b.end_time, b.date) > now)
      .sort((a, b) => toDate(a.start_time) - toDate(b.start_time))[0]
  }, [cat.activeBookings])

  const routeSearch = params.toString() ? `?${params}` : ''
  const bookedCourseIds = new Set(cat.bookings.courses.map((c) => c.course_id))

  return (
    <Page>
      <section className="hello">
        <div>
          <p className="eyebrow">{greeting()}</p>
          <h1>{user.name.split(' ')[0]}, what shall we learn today? <span className="wag">🐾</span></h1>
        </div>
        {user.role === 'STUDENT' && nextUp && (
          <Link to={`/courses/${nextUp.course?.course_id}?class=${nextUp.class_id}`} className="upnext">
            <Ticket size={20} />
            <div>
              <small>Up next</small>
              <strong>{nextUp.course?.title}</strong>
              <span>{fmtDay(toDate(nextUp.start_time))} · {fmtTime(toDate(nextUp.start_time))} · Seat {nextUp.seat?.seat_id}</span>
            </div>
            <ArrowRight size={18} />
          </Link>
        )}
      </section>

      <section className="filters card-flat">
        <div className="search">
          <Search size={18} />
          <input value={q} onChange={(e) => setQuery(e.target.value)} placeholder="Search courses…" aria-label="Search courses" />
          {q && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}
        </div>

        <div className="frow">
          <label><CalendarDays size={16} /> Day</label>
          <div className="chips scroll">
            <button className={`pill ${!day ? 'on' : ''}`} onClick={() => setParam('date', '')}>Any day</button>
            {days.map(([d, n]) => {
              const dt = new Date(`${d}T12:00:00`)
              return (
                <button key={d} className={`pill daypill ${day === d ? 'on' : ''}`} onClick={() => setParam('date', d)}>
                  <small>{fmtDay(dt, { weekday: 'short' })}</small>
                  <b>{dt.getDate()}</b>
                  <small>{fmtDay(dt, { month: 'short' })}</small>
                  <i>{n}</i>
                </button>
              )
            })}
            {!days.length && <span className="muted tiny">No upcoming classes match</span>}
          </div>
        </div>

        <div className="frow">
          <label><GraduationCap size={16} /> Trainer</label>
          <div className="chips scroll">
            <button className={`pill ${!teacher ? 'on' : ''}`} onClick={() => setParam('teacher', '')}>Anyone</button>
            {cat.teachers.map((t) => (
              <button key={t.teacher_id} className={`pill ${teacher === String(t.teacher_id) ? 'on' : ''}`} onClick={() => setParam('teacher', String(t.teacher_id))}>
                <i className="mini-av" style={{ '--h': hueFor(t.name) }}>{initials(t.name)}</i>{t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="frow">
          <label><DoorOpen size={16} /> Room</label>
          <div className="chips scroll">
            <button className={`pill ${!room ? 'on' : ''}`} onClick={() => setParam('room', '')}>Any room</button>
            {cat.classrooms.map((r) => (
              <button key={r.classroom_id} className={`pill ${room === String(r.classroom_id) ? 'on' : ''}`} onClick={() => setParam('room', String(r.classroom_id))}>
                {r.room_name} <small className="muted">{r.room_number}</small>
              </button>
            ))}
          </div>
        </div>

        {(filtered || q) && (
          <button className="link clear" onClick={clearAll}><X size={14} /> Clear all filters</button>
        )}
      </section>

      <div className="results-head">
        <h2>{filtered || q ? 'Matching courses' : 'All courses'}</h2>
        <span className="muted">{rows.length} {rows.length === 1 ? 'course' : 'courses'}</span>
      </div>

      {cat.loading ? (
        <div className="grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="card skeleton" />)}</div>
      ) : cat.error ? (
        <Empty emoji="🙀" title="Couldn't fetch the courses">{cat.error} <button className="link" onClick={cat.refresh}>Try again</button></Empty>
      ) : rows.length ? (
        <div className="grid">
          {rows.map((r, i) => (
            <CourseCard key={r.course.course_id} index={i} course={r.course} sessions={r.sessions} booked={bookedCourseIds.has(r.course.course_id)} search={routeSearch} />
          ))}
        </div>
      ) : (
        <Empty emoji="🦴" title="Nothing to fetch here">No courses match those filters. <button className="link" onClick={clearAll}>Reset filters</button></Empty>
      )}
    </Page>
  )
}
