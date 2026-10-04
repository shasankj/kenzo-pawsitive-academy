import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

// Short timeouts so a missing network route fails fast instead of hanging the Lambda
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 3000, requestTimeout: 5000 },
  })
);
const TABLE = process.env.BOOKINGS_TABLE ?? "SeatBookings";
const INDEX = process.env.BOOKINGS_STUDENT_INDEX ?? "student-index";

async function queryAll(params) {
  const items = [];
  let startKey;
  do {
    const res = await ddb.send(new QueryCommand({ ...params, ExclusiveStartKey: startKey }));
    items.push(...(res.Items ?? []));
    startKey = res.LastEvaluatedKey;
  } while (startKey);
  return items;
}

// Seat items booked in one class: [{ class_id, sk, student_id, row, col, ... }]
export function getClassSeatBookings(classId) {
  return queryAll({
    TableName: TABLE,
    KeyConditionExpression: "class_id = :c AND begins_with(sk, :p)",
    ExpressionAttributeValues: { ":c": String(classId), ":p": "SEAT#" },
    ConsistentRead: true,
  });
}

// Seat items booked by one student across all classes (uses the student-index GSI)
export function getStudentSeatBookings(studentId) {
  return queryAll({
    TableName: TABLE,
    IndexName: INDEX,
    KeyConditionExpression: "student_id = :s",
    ExpressionAttributeValues: { ":s": String(studentId) },
  });
}

// Removes a seat and the matching "one seat per student" marker together, so neither is left behind
export async function deleteSeatBooking(classId, seatSk, studentId) {
  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        { Delete: { TableName: TABLE, Key: { class_id: String(classId), sk: seatSk } } },
        { Delete: { TableName: TABLE, Key: { class_id: String(classId), sk: `STUDENT#${studentId}` } } },
      ],
    })
  );
}
