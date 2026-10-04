import { handle, parseBody, created, HttpError } from "../shared/http.js";
import { parseNewUser, createUser } from "../shared/users.js";
import { publishEvent } from "../shared/events.js";

// POST /signup   (public)
// Body: { "name": "...", "email": "...", "password": "...", "role": "STUDENT" | "TEACHER" }
// The account is created as PENDING and can't log in until an admin approves it.
export const handler = handle(async (event) => {
  const body = parseBody(event);
  const input = parseNewUser(body);

  // ADMIN can never be requested through public signup
  const role = body.role;
  if (role !== "STUDENT" && role !== "TEACHER") {
    throw new HttpError(400, "INVALID_PARAMETER", "role must be STUDENT or TEACHER");
  }

  const user = await createUser({ ...input, role, status: "PENDING" });

  // Lets the admin get notified once an SNS topic is configured (see EVENTS_TOPIC_ARN)
  await publishEvent("SignupRequested", {
    userId: user.user_id,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  return created({
    message: "Signup received. An admin will review your request.",
    status: user.status,
  });
});
