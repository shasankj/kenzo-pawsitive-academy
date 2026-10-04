import { handle, parseBody, created } from "../shared/http.js";
import { requireRole } from "../shared/auth.js";
import { parseNewUser, createUser } from "../shared/users.js";

// POST /addStudent   (ADMIN only)
// Body: { "name": "...", "email": "...", "password": "..." }
// The account is ACTIVE straight away: the admin is the approval.
export const handler = handle(async (event) => {
  const admin = requireRole(event, ["ADMIN"]);
  const input = parseNewUser(parseBody(event));

  const user = await createUser({
    ...input,
    role: "STUDENT",
    status: "ACTIVE",
    reviewedBy: admin.userId,
  });

  return created({ user });
});
