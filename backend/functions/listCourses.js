import { query, UPCOMING } from "../shared/db.js";
import { handle, optionalId } from "../shared/http.js";

// GET /courses
// GET /courses?classroom_id=3   -> courses scheduled in that classroom
// GET /courses?teacher_id=2     -> courses taught by that teacher
export const handler = handle(async (event) => {
  const q = event.queryStringParameters;
  const classroomId = optionalId(q, "classroom_id");
  const teacherId = optionalId(q, "teacher_id");

  const courses = await query(
    `SELECT c.course_id, c.title, c.description, c.subject
       FROM courses c
      WHERE EXISTS (
            SELECT 1
              FROM classes cl
             WHERE cl.course_id = c.course_id
               AND cl.status = 'SCHEDULED'
               AND ${UPCOMING}
               AND ($1::bigint IS NULL OR cl.classroom_id = $1::bigint)
               AND ($2::bigint IS NULL OR cl.teacher_id   = $2::bigint))
      ORDER BY c.title`,
    [classroomId, teacherId]
  );

  return { courses };
});
