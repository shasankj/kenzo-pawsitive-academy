import { query, UPCOMING } from "../shared/db.js";
import { handle, optionalId, optionalDate } from "../shared/http.js";

// GET /classes?course_id=1
// GET /classes?classroom_id=3&course_id=1
// GET /classes?teacher_id=2&course_id=1
// GET /classes?course_id=1&date=2026-10-05
// Filters can be combined freely; each row has the date, times, teacher and room.
export const handler = handle(async (event) => {
  const q = event.queryStringParameters;
  const courseId = optionalId(q, "course_id");
  const classroomId = optionalId(q, "classroom_id");
  const teacherId = optionalId(q, "teacher_id");
  const date = optionalDate(q, "date");

  const rows = await query(
    `SELECT cl.class_id,
            to_char(cl.start_time, 'YYYY-MM-DD') AS class_date,
            cl.start_time, cl.end_time,
            c.course_id, c.title AS course_title, c.subject,
            t.user_id AS teacher_id, t.name AS teacher_name,
            cr.classroom_id, cr.room_number, cr.room_name, cr.capacity
       FROM classes cl
       JOIN courses    c  ON c.course_id     = cl.course_id
       JOIN users      t  ON t.user_id       = cl.teacher_id
       JOIN classrooms cr ON cr.classroom_id = cl.classroom_id
      WHERE cl.status = 'SCHEDULED'
        AND ${UPCOMING}
        AND ($1::bigint IS NULL OR cl.course_id    = $1::bigint)
        AND ($2::bigint IS NULL OR cl.classroom_id = $2::bigint)
        AND ($3::bigint IS NULL OR cl.teacher_id   = $3::bigint)
        AND ($4::date   IS NULL OR (cl.start_time >= $4::date
                                AND cl.start_time <  $4::date + 1))
      ORDER BY cl.start_time
      LIMIT 200`,
    [courseId, classroomId, teacherId, date]
  );

  return {
    classes: rows.map((r) => ({
      class_id: r.class_id,
      date: r.class_date,
      start_time: r.start_time,
      end_time: r.end_time,
      course: { course_id: r.course_id, title: r.course_title, subject: r.subject },
      teacher: { teacher_id: r.teacher_id, name: r.teacher_name },
      classroom: {
        classroom_id: r.classroom_id,
        room_number: r.room_number,
        room_name: r.room_name,
        capacity: r.capacity,
      },
    })),
  };
});
