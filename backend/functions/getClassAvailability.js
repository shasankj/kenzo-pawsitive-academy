import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { query } from "../shared/db.js";
import { handle, requiredId, HttpError } from "../shared/http.js";

// Short timeouts so a missing network route fails fast instead of hanging the Lambda
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 3000, requestTimeout: 5000 },
  })
);
const TABLE = process.env.BOOKINGS_TABLE ?? "SeatBookings";

// Returns a Set of "row-col" strings for every booked seat in the class.
// Student IDs are intentionally not read or returned: other students shouldn't see who sits where.
async function getBookedSeats(classId) {
  const booked = new Set();
  let startKey;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "class_id = :c AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":c": String(classId), ":p": "SEAT#" },
        ProjectionExpression: "#r, #c",
        ExpressionAttributeNames: { "#r": "row", "#c": "col" },
        ConsistentRead: true, // always read the latest bookings
        ExclusiveStartKey: startKey,
      })
    );
    for (const item of res.Items ?? []) booked.add(`${item.row}-${item.col}`);
    startKey = res.LastEvaluatedKey;
  } while (startKey);
  return booked;
}

// GET /classes/{class_id}/availability
export const handler = handle(async (event) => {
  const classId = requiredId(event.pathParameters, "class_id");

  // 1. Class, course, teacher and room layout from Postgres (source of truth)
  const [cls] = await query(
    `SELECT cl.class_id, cl.status, cl.start_time, cl.end_time,
            c.course_id, c.title AS course_title,
            t.user_id AS teacher_id, t.name AS teacher_name,
            cr.classroom_id, cr.room_number, cr.room_name,
            cr.total_rows, cr.total_columns
       FROM classes cl
       JOIN courses    c  ON c.course_id     = cl.course_id
       JOIN users      t  ON t.user_id       = cl.teacher_id
       JOIN classrooms cr ON cr.classroom_id = cl.classroom_id
      WHERE cl.class_id = $1`,
    [classId]
  );

  if (!cls) throw new HttpError(404, "CLASS_NOT_FOUND", `No class found with class_id ${classId}`);
  if (cls.status === "CANCELLED") {
    throw new HttpError(409, "CLASS_CANCELLED", "This class has been cancelled");
  }

  // 2. Booked seats from DynamoDB
  const booked = await getBookedSeats(classId);

  // 3. Build the full grid and mark each seat
  const seats = [];
  for (let r = 1; r <= cls.total_rows; r++) {
    for (let c = 1; c <= cls.total_columns; c++) {
      seats.push({
        seat_id: `${String.fromCharCode(64 + r)}${c}`, // row 1 -> A, row 2 -> B (fine up to 26 rows)
        row: r,
        col: c,
        available: !booked.has(`${r}-${c}`),
      });
    }
  }

  const availableCount = seats.filter((s) => s.available).length;

  return {
    class: {
      class_id: cls.class_id,
      start_time: cls.start_time,
      end_time: cls.end_time,
      course: { course_id: cls.course_id, title: cls.course_title },
      teacher: { teacher_id: cls.teacher_id, name: cls.teacher_name },
      classroom: {
        classroom_id: cls.classroom_id,
        room_number: cls.room_number,
        room_name: cls.room_name,
      },
    },
    layout: { total_rows: cls.total_rows, total_columns: cls.total_columns },
    capacity: seats.length,
    available_count: availableCount,
    booked_count: seats.length - availableCount,
    seats,
  };
});
