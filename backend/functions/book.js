import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { query } from "../shared/db.js";
import { handle, parseBody, requiredInt, created, HttpError } from "../shared/http.js";
import { requireRole } from "../shared/auth.js";
import { publishEvent } from "../shared/events.js";

// Short timeouts so a missing network route fails fast instead of hanging the Lambda
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 3000, requestTimeout: 5000 },
  })
);
const TABLE = process.env.BOOKINGS_TABLE ?? "SeatBookings";
const RETAIN_SECONDS = 7 * 24 * 3600; // keep bookings for 7 days after the class (DynamoDB TTL)

// POST /book   (STUDENT only)
// Body: { "class_id": 1, "row": 2, "col": 3 }
// The student is taken from the login token, never from the request body.
export const handler = handle(async (event) => {
  const student = requireRole(event, ["STUDENT"]);
  const body = parseBody(event);
  const classId = requiredInt(body, "class_id");
  const row = requiredInt(body, "row", { max: 100 });
  const col = requiredInt(body, "col", { max: 100 });

  // 1. Validate against Postgres, the source of truth for classes and rooms
  const [cls] = await query(
    `SELECT cl.class_id, cl.status, cl.start_time, cl.end_time,
            cr.total_rows, cr.total_columns, cr.room_name, cr.room_number,
            c.title AS course_title,
            t.name  AS teacher_name,
            u.status AS student_status, u.name AS student_name, u.email AS student_email,
            EXISTS (SELECT 1 FROM enrollments e
                     WHERE e.student_id = $2 AND e.course_id = cl.course_id) AS enrolled
       FROM classes cl
       JOIN classrooms cr ON cr.classroom_id = cl.classroom_id
       JOIN courses    c  ON c.course_id     = cl.course_id
       JOIN users      t  ON t.user_id       = cl.teacher_id
       JOIN users      u  ON u.user_id       = $2
      WHERE cl.class_id = $1`,
    [classId, student.userId]
  );

  if (!cls) throw new HttpError(404, "CLASS_NOT_FOUND", `No class found with class_id ${classId}`);
  // A suspended or removed student may still hold a valid token for up to an hour
  if (cls.student_status !== "ACTIVE") {
    throw new HttpError(403, "ACCOUNT_UNAVAILABLE", "Your account can't make bookings");
  }
  if (cls.status !== "SCHEDULED") {
    throw new HttpError(409, "CLASS_CANCELLED", "This class has been cancelled");
  }
  // Booking closes when the class starts. SHOW_PAST=true skips this check while testing.
  if (process.env.SHOW_PAST !== "true" && new Date(cls.start_time) <= new Date()) {
    throw new HttpError(409, "BOOKING_CLOSED", "Booking is closed for this class");
  }
  if (row > cls.total_rows || col > cls.total_columns) {
    throw new HttpError(
      400,
      "SEAT_OUT_OF_RANGE",
      `This room has ${cls.total_rows} rows and ${cls.total_columns} columns`
    );
  }
  // No API creates enrollments yet, so this is off by default.
  // Set REQUIRE_ENROLLMENT=true once students are enrolled in courses.
  if (process.env.REQUIRE_ENROLLMENT === "true" && !cls.enrolled) {
    throw new HttpError(403, "NOT_ENROLLED", "You are not enrolled in this course");
  }

  // 2. Book atomically in DynamoDB. Both writes succeed or neither does:
  //    - the seat item fails if the seat is already taken
  //    - the student item fails if this student already has a seat in this class
  const seatSk = `SEAT#R${row}#C${col}`;
  const expiresAt = Math.floor(new Date(cls.end_time).getTime() / 1000) + RETAIN_SECONDS;

  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLE,
              Item: {
                class_id: String(classId),
                sk: seatSk,
                student_id: String(student.userId),
                row,
                col,
                booked_at: new Date().toISOString(),
                expires_at: expiresAt,
              },
              ConditionExpression: "attribute_not_exists(sk)",
            },
          },
          {
            Put: {
              TableName: TABLE,
              Item: {
                class_id: String(classId),
                sk: `STUDENT#${student.userId}`,
                seat_sk: seatSk,
                expires_at: expiresAt,
              },
              ConditionExpression: "attribute_not_exists(sk)",
            },
          },
        ],
      })
    );
  } catch (err) {
    if (err.name === "TransactionCanceledException") {
      const reasons = err.CancellationReasons ?? [];
      if (reasons[1]?.Code === "ConditionalCheckFailed") {
        throw new HttpError(409, "ALREADY_BOOKED", "You already have a seat in this class");
      }
      if (reasons[0]?.Code === "ConditionalCheckFailed") {
        throw new HttpError(409, "SEAT_TAKEN", "That seat was just taken. Please pick another.");
      }
    }
    throw err;
  }

  const seatId = `${String.fromCharCode(64 + row)}${col}`; // row 1 -> A, row 2 -> B ...

  // Confirmation email (SNS -> SQS -> sendEmails Lambda -> SES). The event carries everything
  // the email needs, so the email Lambda doesn't have to query the database.
  await publishEvent("BookingConfirmed", {
    classId,
    studentId: student.userId,
    studentName: cls.student_name,
    studentEmail: cls.student_email,
    seat: seatId,
    courseTitle: cls.course_title,
    teacherName: cls.teacher_name,
    roomName: cls.room_name,
    roomNumber: cls.room_number,
    startTime: cls.start_time,
    endTime: cls.end_time,
  });

  return created({
    message: "Seat booked",
    booking: { class_id: classId, seat_id: seatId, row, col },
  });
});
