import { query } from "./db.js";
import { getClassSeatBookings } from "./bookings.js";
import { publishEvent } from "./events.js";

const CHUNK = 10; // publish this many notifications at a time

// Cancels every upcoming SCHEDULED class matching `condition`, then queues one
// "ClassCancelled" event per affected booking (the email Lambda sends them).
//
// `condition` is a fixed SQL fragment written in this file, never user input;
// its values go in conditionParams, which start at $3.
//
// Bookings are deliberately kept: the student's dashboard then shows the class as
// CANCELLED, and the DynamoDB TTL cleans them up after the class date.
async function cancelWhere(condition, conditionParams, cancelledBy, reason) {
  const classes = await query(
    `UPDATE classes cl
        SET status = 'CANCELLED', cancelled_at = now(), cancelled_by = $1, cancel_reason = $2
       FROM courses c, users t, classrooms cr
      WHERE c.course_id    = cl.course_id
        AND t.user_id      = cl.teacher_id
        AND cr.classroom_id = cl.classroom_id
        AND cl.status = 'SCHEDULED'
        AND cl.end_time > now()
        AND ${condition}
      RETURNING cl.class_id, cl.start_time, cl.end_time,
                c.title AS course_title, t.name AS teacher_name,
                cr.room_name, cr.room_number`,
    [cancelledBy, reason ?? null, ...conditionParams]
  );
  if (classes.length === 0) return { classes, studentsAffected: 0 };

  // Who had a seat in each cancelled class? (DynamoDB)
  const pairs = [];
  for (const cls of classes) {
    for (const seat of await getClassSeatBookings(cls.class_id)) {
      if (seat.student_id) pairs.push({ cls, studentId: Number(seat.student_id) });
    }
  }
  if (pairs.length === 0) return { classes, studentsAffected: 0 };

  // Their names and emails (Postgres)
  const studentIds = [...new Set(pairs.map((p) => p.studentId))];
  const students = await query(
    `SELECT user_id, name, email FROM users WHERE user_id = ANY($1::bigint[]) AND status <> 'REMOVED'`,
    [studentIds]
  );
  const byId = new Map(students.map((s) => [s.user_id, s]));

  const events = pairs
    .filter((p) => byId.has(p.studentId))
    .map(({ cls, studentId }) => ({
      studentId,
      studentName: byId.get(studentId).name,
      studentEmail: byId.get(studentId).email,
      classId: cls.class_id,
      courseTitle: cls.course_title,
      teacherName: cls.teacher_name,
      roomName: cls.room_name,
      roomNumber: cls.room_number,
      startTime: cls.start_time,
      endTime: cls.end_time,
      reason: reason ?? null,
    }));

  for (let i = 0; i < events.length; i += CHUNK) {
    await Promise.all(events.slice(i, i + CHUNK).map((e) => publishEvent("ClassCancelled", e)));
  }

  return { classes, studentsAffected: studentIds.length };
}

export const cancelClassById = (classId, by, reason) =>
  cancelWhere("cl.class_id = $3", [classId], by, reason);

export const cancelClassesByCourse = (courseId, by, reason) =>
  cancelWhere("cl.course_id = $3", [courseId], by, reason);

export const cancelClassesByTeacher = (teacherId, by, reason) =>
  cancelWhere("cl.teacher_id = $3", [teacherId], by, reason);
