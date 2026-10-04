import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarClock, DoorOpen, Check } from 'lucide-react'
import { hueFor, subjectEmoji, initials, toDate, fmtDay, fmtTime } from '../util'

export default function CourseCard({ course, sessions, index = 0, booked, search = '' }) {
  const teachers = [...new Map(sessions.map((s) => [s.teacher?.teacher_id, s.teacher])).values()].filter(Boolean)
  const rooms = [...new Map(sessions.map((s) => [s.classroom?.classroom_id, s.classroom])).values()].filter(Boolean)
  const next = sessions[0]
  const nextDate = next && toDate(next.start_time, next.date)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.06, type: 'spring', stiffness: 220, damping: 22 }}
      whileHover={{ y: -8, rotate: -0.6 }}
    >
      <Link to={`/courses/${course.course_id}${search}`} className="card course" style={{ '--h': hueFor(course.subject) }}>
        <div className="course-top">
          <span className="chip chip-glass">{course.subject}</span>
          {booked && <span className="chip chip-ok"><Check size={14} /> Booked</span>}
          <div className="course-emoji">{subjectEmoji(course.subject)}</div>
        </div>
        <div className="course-body">
          <h3>{course.title}</h3>
          <p className="clamp">{course.description || 'A mystery course — the best kind.'}</p>

          {sessions.length ? (
            <>
              <div className="course-meta">
                <div className="stack" title={teachers.map((t) => t.name).join(', ')}>
                  {teachers.slice(0, 4).map((t) => <i key={t.teacher_id} style={{ '--h': hueFor(t.name) }}>{initials(t.name)}</i>)}
                  {teachers.length > 4 && <i className="more">+{teachers.length - 4}</i>}
                </div>
                <span className="meta-text">{teachers.length === 1 ? teachers[0].name : `${teachers.length} trainers`}</span>
                <span className="meta-text"><DoorOpen size={15} /> {rooms.length === 1 ? rooms[0].room_name : `${rooms.length} rooms`}</span>
              </div>
              <div className="course-next">
                <CalendarClock size={16} />
                <span>Next: <b>{fmtDay(nextDate)}</b> · {fmtTime(nextDate)}</span>
                <em>{sessions.length} {sessions.length === 1 ? 'class' : 'classes'}</em>
              </div>
            </>
          ) : (
            <div className="course-next muted-row"><CalendarClock size={16} /><span>No classes scheduled yet</span></div>
          )}
        </div>
      </Link>
    </motion.div>
  )
}
