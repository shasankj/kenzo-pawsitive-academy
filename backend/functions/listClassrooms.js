import { query, UPCOMING } from "../shared/db.js";
import { handle, optionalId } from "../shared/http.js";

// GET /classrooms
// GET /classrooms?course_id=1   -> classrooms where that course is scheduled
// GET /classrooms?teacher_id=2  -> classrooms where that teacher is scheduled
export const handler = handle(async (event) => {
  const q = event.queryStringParameters;
  const courseId = optionalId(q, "course_id");
  const teacherId = optionalId(q, "teacher_id");

  const classrooms = await query(
    `SELECT cr.classroom_id, cr.room_number, cr.room_name,
            cr.total_rows, cr.total_columns, cr.capacity
       FROM classrooms cr
      WHERE EXISTS (
            SELECT 1
              FROM classes cl
             WHERE cl.classroom_id = cr.classroom_id
               AND cl.status = 'SCHEDULED'
               AND ${UPCOMING}
               AND ($1::bigint IS NULL OR cl.course_id  = $1::bigint)
               AND ($2::bigint IS NULL OR cl.teacher_id = $2::bigint))
      ORDER BY cr.room_number`,
    [courseId, teacherId]
  );

  return { classrooms };
});
