import { query, UPCOMING } from "../shared/db.js";
import { handle, optionalId } from "../shared/http.js";

// GET /teachers
// GET /teachers?course_id=1      -> teachers who teach that course
// GET /teachers?classroom_id=3   -> teachers scheduled in that classroom
// Email is deliberately not returned: this endpoint is student-facing.
export const handler = handle(async (event) => {
  const q = event.queryStringParameters;
  const courseId = optionalId(q, "course_id");
  const classroomId = optionalId(q, "classroom_id");

  const teachers = await query(
    `SELECT t.user_id AS teacher_id, t.name
       FROM users t
      WHERE t.role = 'TEACHER'
        AND EXISTS (
            SELECT 1
              FROM classes cl
             WHERE cl.teacher_id = t.user_id
               AND cl.status = 'SCHEDULED'
               AND ${UPCOMING}
               AND ($1::bigint IS NULL OR cl.course_id    = $1::bigint)
               AND ($2::bigint IS NULL OR cl.classroom_id = $2::bigint))
      ORDER BY t.name`,
    [courseId, classroomId]
  );

  return { teachers };
});
