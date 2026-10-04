import { query } from "../shared/db.js";
import { handle, parseBody, requiredInt, optionalString, HttpError } from "../shared/http.js";
import { requireRole } from "../shared/auth.js";
import { cancelClassesByCourse } from "../shared/cancellations.js";

// POST /cancelCourse   (ADMIN only)
// Body: { "course_id": 1, "reason": "Course discontinued" (optional) }
// Marks the course CANCELLED, cancels all its upcoming classes, and queues an email to every
// student who had a seat. Safe to run again if it was interrupted: it picks up any classes left.
export const handler = handle(async (event) => {
  const caller = requireRole(event, ["ADMIN"]);
  const body = parseBody(event);
  const courseId = requiredInt(body, "course_id");
  const reason = optionalString(body, "reason", { max: 500 });

  const [course] = await query(`SELECT course_id, title, status FROM courses WHERE course_id = $1`, [courseId]);
  if (!course) throw new HttpError(404, "COURSE_NOT_FOUND", `No course found with course_id ${courseId}`);

  await query(`UPDATE courses SET status = 'CANCELLED' WHERE course_id = $1`, [courseId]);

  const { classes, studentsAffected } = await cancelClassesByCourse(courseId, caller.userId, reason);

  if (course.status === "CANCELLED" && classes.length === 0) {
    throw new HttpError(409, "ALREADY_CANCELLED", "This course is already cancelled");
  }

  return {
    message: "Course cancelled",
    course: { course_id: course.course_id, title: course.title },
    classes_cancelled: classes.length,
    students_affected: studentsAffected,
  };
});
