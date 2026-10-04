import { query, isUniqueViolation } from "../shared/db.js";
import { handle, parseBody, requiredString, requiredInt, created, HttpError } from "../shared/http.js";
import { requireRole } from "../shared/auth.js";

// POST /addClassroom   (ADMIN only)
// Body: { "room_number": 111, "room_name": "Lab A", "total_rows": 5, "total_columns": 8 }
export const handler = handle(async (event) => {
  requireRole(event, ["ADMIN"]);
  const body = parseBody(event);

  const roomNumber = requiredInt(body, "room_number", { max: 100000 });
  const roomName = requiredString(body, "room_name", { max: 100 });
  const totalRows = requiredInt(body, "total_rows", { max: 50 });
  const totalColumns = requiredInt(body, "total_columns", { max: 50 });

  try {
    const [classroom] = await query(
      `INSERT INTO classrooms (room_number, room_name, total_rows, total_columns)
       VALUES ($1, $2, $3, $4)
       RETURNING classroom_id, room_number, room_name, total_rows, total_columns, capacity`,
      [roomNumber, roomName, totalRows, totalColumns]
    );
    return created({ classroom });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, "ROOM_EXISTS", `Room number ${roomNumber} already exists`);
    }
    throw err;
  }
});
