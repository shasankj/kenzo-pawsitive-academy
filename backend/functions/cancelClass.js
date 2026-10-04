import { query } from "../shared/db.js";
import { handle, parseBody, requiredInt, optionalString, HttpError } from "../shared/http.js";
import { requireRole } from "../shared/auth.js";
import { cancelClassById } from "../shared/cancellations.js";

// POST /cancelClass   (ADMIN, or the TEACHER who teaches that class)
// Body: { "class_id": 1, "reason": "Teacher is ill" (optional) }
// Marks the class CANCELLED and queues an email to every student who booked a seat.
export const handler = handle(async (event) => {
  const caller = requireRole(event, ["ADMIN", "TEACHER"]);
  const body = parseBody(event);
  const classId = requiredInt(body, "class_id");
  const reason = optionalString(body, "reason", { max: 500 });

  const [existing] = await query(
    `SELECT class_id, teacher_id, status, end_time FROM classes WHERE class_id = $1`,
    [classId]
  );
  if (!existing) throw new HttpError(404, "CLASS_NOT_FOUND", `No class found with class_id ${classId}`);

  if (caller.role === "TEACHER" && existing.teacher_id !== caller.userId) {
    throw new HttpError(403, "FORBIDDEN", "You can only cancel your own classes");
  }
  if (existing.status === "CANCELLED") {
    throw new HttpError(409, "ALREADY_CANCELLED", "This class is already cancelled");
  }
  if (new Date(existing.end_time) <= new Date()) {
    throw new HttpError(409, "CLASS_ALREADY_ENDED", "This class has already ended");
  }

  const { classes, studentsAffected } = await cancelClassById(classId, caller.userId, reason);
  if (classes.length === 0) {
    // Someone cancelled it between our check and the update
    throw new HttpError(409, "ALREADY_CANCELLED", "This class is already cancelled");
  }

  const c = classes[0];
  return {
    message: "Class cancelled",
    class: {
      class_id: c.class_id,
      course_title: c.course_title,
      start_time: c.start_time,
      end_time: c.end_time,
    },
    students_affected: studentsAffected,
  };
});
