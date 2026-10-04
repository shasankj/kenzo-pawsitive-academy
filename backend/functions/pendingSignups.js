import { query } from "../shared/db.js";
import { handle } from "../shared/http.js";
import { requireRole } from "../shared/auth.js";

// GET /pendingSignups   (ADMIN only)
// The admin's inbox: everyone who signed up and is waiting for approval, oldest first.
export const handler = handle(async (event) => {
  requireRole(event, ["ADMIN"]);

  const pending = await query(
    `SELECT user_id, name, email, role, created_at
       FROM users
      WHERE status = 'PENDING'
      ORDER BY created_at
      LIMIT 100`
  );

  return { count: pending.length, pending };
});
