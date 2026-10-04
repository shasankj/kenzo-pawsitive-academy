import { query } from "./db.js";
import { HttpError } from "./http.js";
import { cancelClassesByTeacher } from "./cancellations.js";
import { getStudentSeatBookings, deleteSeatBooking } from "./bookings.js";

// Frees every seat a student holds in upcoming classes. Returns how many were released.
async function releaseStudentBookings(studentId) {
  const items = await getStudentSeatBookings(studentId);
  if (items.length === 0) return 0;

  const classIds = [...new Set(items.map((i) => Number(i.class_id)))];
  const upcoming = await query(
    `SELECT class_id FROM classes WHERE class_id = ANY($1::bigint[]) AND end_time > now()`,
    [classIds]
  );
  const stillUpcoming = new Set(upcoming.map((r) => r.class_id));

  let released = 0;
  for (const item of items) {
    if (!stillUpcoming.has(Number(item.class_id))) continue;
    await deleteSeatBooking(item.class_id, item.sk, studentId);
    released += 1;
  }
  return released;
}

// Changes a TEACHER's or STUDENT's account status. Accounts are never deleted: removal is
// a soft delete (REMOVED), because classes, bookings and history still refer to the user.
//
//   admin           caller from requireRole
//   allowedFrom     statuses the account may currently have
//   cancelClasses   TEACHER: also cancel their upcoming classes (required if they have any)
//   releaseBookings STUDENT: also free the seats they hold in upcoming classes
export async function setAccountStatus({
  admin,
  userId,
  newStatus,
  allowedFrom,
  reason = null,
  cancelClasses = false,
  releaseBookings = false,
}) {
  if (userId === admin.userId) {
    throw new HttpError(400, "INVALID_PARAMETER", "You can't change your own account status");
  }

  const [user] = await query(`SELECT user_id, name, email, role, status FROM users WHERE user_id = $1`, [userId]);
  if (!user) throw new HttpError(404, "USER_NOT_FOUND", `No user found with user_id ${userId}`);
  if (user.role === "ADMIN") {
    throw new HttpError(403, "FORBIDDEN", "Admin accounts can't be changed through this API");
  }
  if (!allowedFrom.includes(user.status)) {
    throw new HttpError(409, "INVALID_STATE", `This account is ${user.status}, so this action doesn't apply`);
  }

  let classesCancelled = 0;
  if (user.role === "TEACHER" && newStatus !== "ACTIVE") {
    const [{ n }] = await query(
      `SELECT count(*)::int AS n FROM classes
        WHERE teacher_id = $1 AND status = 'SCHEDULED' AND end_time > now()`,
      [userId]
    );
    if (n > 0 && !cancelClasses) {
      throw new HttpError(
        409,
        "TEACHER_HAS_UPCOMING_CLASSES",
        `This teacher has ${n} upcoming class(es). Send "cancel_classes": true to cancel them and notify the students.`
      );
    }
    if (n > 0) {
      const { classes } = await cancelClassesByTeacher(userId, admin.userId, reason ?? "Teacher unavailable");
      classesCancelled = classes.length;
    }
  }

  const [updated] = await query(
    `UPDATE users
        SET status = $2, status_reason = $3, status_changed_at = now(), status_changed_by = $4
      WHERE user_id = $1
      RETURNING user_id, name, email, role, status`,
    [userId, newStatus, reason, admin.userId]
  );

  const bookingsReleased =
    user.role === "STUDENT" && releaseBookings ? await releaseStudentBookings(userId) : 0;

  return { user: updated, classes_cancelled: classesCancelled, bookings_released: bookingsReleased };
}
