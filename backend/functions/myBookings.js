import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { query } from "../shared/db.js";
import { handle, HttpError } from "../shared/http.js";
import { requireRole } from "../shared/auth.js";

// Short timeouts so a missing network route fails fast instead of hanging the Lambda
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 3000, requestTimeout: 5000 },
  })
);
const TABLE = process.env.BOOKINGS_TABLE ?? "SeatBookings";
const INDEX = process.env.BOOKINGS_STUDENT_INDEX ?? "student-index";
const MAX_BOOKINGS = 500; // safety cap; a student will never get near this

// All seat bookings for one student, newest booking first.
// Uses the student-index GSI (partition key student_id, sort key booked_at).
// Note: GSI reads are eventually consistent, so a seat booked a split second ago
// can take a moment to appear here.
async function getStudentBookings(studentId) {
  const items = [];
  let startKey;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: INDEX,
        KeyConditionExpression: "student_id = :s",
        ExpressionAttributeValues: { ":s": String(studentId) },
        ScanIndexForward: false,
        ExclusiveStartKey: startKey,
      })
    );
    items.push(...(res.Items ?? []));
    startKey = res.LastEvaluatedKey;
  } while (startKey && items.length < MAX_BOOKINGS);
  return items;
}

// GET /myBookings            -> upcoming bookings (default)
// GET /myBookings?when=past  -> classes that have already ended
// GET /myBookings?when=all   -> everything
// STUDENT only. The student comes from the login token, never from the request.
export const handler = handle(async (event) => {
  const student = requireRole(event, ["STUDENT"]);

  const when = event.queryStringParameters?.when ?? "upcoming";
  if (!["upcoming", "past", "all"].includes(when)) {
    throw new HttpError(400, "INVALID_PARAMETER", "when must be upcoming, past or all");
  }

  // 1. Which seats has this student booked? (DynamoDB)
  const items = await getStudentBookings(student.userId);
  if (items.length === 0) return { count: 0, courses: [], bookings: [] };

  // 2. Class, course, teacher and room details for those classes (Postgres)
  const classIds = [...new Set(items.map((i) => Number(i.class_id)))];
  const classes = await query(
    `SELECT cl.class_id, cl.status, cl.start_time, cl.end_time,
            c.course_id, c.title AS course_title, c.subject,
            t.user_id AS teacher_id, t.name AS teacher_name,
            cr.classroom_id, cr.room_number, cr.room_name
       FROM classes cl
       JOIN courses    c  ON c.course_id     = cl.course_id
       JOIN users      t  ON t.user_id       = cl.teacher_id
       JOIN classrooms cr ON cr.classroom_id = cl.classroom_id
      WHERE cl.class_id = ANY($1::bigint[])`,
    [classIds]
  );
  const byId = new Map(classes.map((c) => [c.class_id, c]));

  // 3. Merge, filter by upcoming/past, sort by class start time
  const now = Date.now();
  const bookings = items
    .map((item) => {
      const cls = byId.get(Number(item.class_id));
      if (!cls) return null; // class no longer exists in Postgres
      return {
        class_id: cls.class_id,
        status: cls.status, // SCHEDULED or CANCELLED, so the dashboard can flag cancellations
        start_time: cls.start_time,
        end_time: cls.end_time,
        course: { course_id: cls.course_id, title: cls.course_title, subject: cls.subject },
        teacher: { teacher_id: cls.teacher_id, name: cls.teacher_name },
        classroom: {
          classroom_id: cls.classroom_id,
          room_number: cls.room_number,
          room_name: cls.room_name,
        },
        seat: {
          seat_id: `${String.fromCharCode(64 + item.row)}${item.col}`, // row 1 -> A
          row: item.row,
          col: item.col,
        },
        booked_at: item.booked_at,
      };
    })
    .filter(Boolean)
    .filter((b) => when === "all" || (when === "upcoming") === (new Date(b.end_time).getTime() > now));

  bookings.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  if (when === "past") bookings.reverse(); // most recent first

  // 4. Distinct courses, with how many of this student's bookings fall under each
  const courseMap = new Map();
  for (const b of bookings) {
    const entry = courseMap.get(b.course.course_id) ?? { ...b.course, classes_booked: 0 };
    entry.classes_booked += 1;
    courseMap.set(b.course.course_id, entry);
  }

  return { count: bookings.length, courses: [...courseMap.values()], bookings };
});
