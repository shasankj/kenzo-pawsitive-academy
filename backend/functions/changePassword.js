import { query } from "../shared/db.js";
import { handle, parseBody, HttpError } from "../shared/http.js";
import { requireRole } from "../shared/auth.js";
import { hashPassword, verifyPassword, dummyHash } from "../shared/password.js";

// POST /changePassword   (any logged-in role)
// Body: { "current_password": "...", "new_password": "..." }
// Give this function at least 512 MB: it runs the password hash twice.
export const handler = handle(async (event) => {
  const caller = requireRole(event, ["STUDENT", "TEACHER", "ADMIN"]);
  const body = parseBody(event);

  const current = body.current_password;
  const next = body.new_password;
  if (typeof current !== "string" || current.length === 0 || current.length > 128) {
    throw new HttpError(400, "INVALID_PARAMETER", "current_password is required");
  }
  if (typeof next !== "string" || next.length < 8 || next.length > 128) {
    throw new HttpError(400, "INVALID_PARAMETER", "new_password must be 8-128 characters");
  }
  if (next === current) {
    throw new HttpError(400, "INVALID_PARAMETER", "new_password must be different from the current password");
  }

  const [user] = await query(`SELECT password_hash, status FROM users WHERE user_id = $1`, [caller.userId]);

  // Always verify, so response time doesn't depend on whether the account has a password
  const currentOk = await verifyPassword(current, user?.password_hash ?? (await dummyHash()));

  // A suspended or removed account may still hold a valid token for up to an hour
  if (!user || user.status !== "ACTIVE") {
    throw new HttpError(403, "ACCOUNT_UNAVAILABLE", "This account can't change its password");
  }
  if (!user.password_hash || !currentOk) {
    // 400, not 401: a 401 would make a client log the user out for a simple typo
    throw new HttpError(400, "INVALID_CURRENT_PASSWORD", "The current password is incorrect");
  }

  await query(`UPDATE users SET password_hash = $2 WHERE user_id = $1`, [
    caller.userId,
    await hashPassword(next),
  ]);

  return { message: "Password updated" };
});
