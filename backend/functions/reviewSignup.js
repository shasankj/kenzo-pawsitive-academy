import { query } from "../shared/db.js";
import { handle, parseBody, requiredInt, HttpError } from "../shared/http.js";
import { requireRole } from "../shared/auth.js";
import { publishEvent } from "../shared/events.js";

// POST /reviewSignup   (ADMIN only)
// Body: { "user_id": 12, "decision": "APPROVE" | "REJECT" }
export const handler = handle(async (event) => {
  const admin = requireRole(event, ["ADMIN"]);
  const body = parseBody(event);

  const userId = requiredInt(body, "user_id");
  const decision = body.decision;
  if (decision !== "APPROVE" && decision !== "REJECT") {
    throw new HttpError(400, "INVALID_PARAMETER", "decision must be APPROVE or REJECT");
  }
  const newStatus = decision === "APPROVE" ? "ACTIVE" : "REJECTED";

  // The status = 'PENDING' condition makes this safe to retry and stops
  // an already-reviewed account from being changed by mistake.
  const [user] = await query(
    `UPDATE users
        SET status = $2, reviewed_by = $3, reviewed_at = now()
      WHERE user_id = $1 AND status = 'PENDING'
      RETURNING user_id, name, email, role, status`,
    [userId, newStatus, admin.userId]
  );
  if (!user) {
    throw new HttpError(409, "NOT_PENDING", "No pending signup found for that user_id");
  }

  // Hook for emailing the user their result (SNS -> SQS -> Lambda -> SES)
  await publishEvent("SignupReviewed", {
    userId: user.user_id,
    email: user.email,
    role: user.role,
    decision,
  });

  return { user };
});
