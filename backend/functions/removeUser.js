import { handle, parseBody, requiredInt, optionalString, optionalBool } from "../shared/http.js";
import { requireRole } from "../shared/auth.js";
import { setAccountStatus } from "../shared/accounts.js";

// POST /removeUser   (ADMIN only; works for teachers and students)
// Body: { "user_id": 12, "reason": "..." (optional),
//         "cancel_classes": true  (teachers with upcoming classes: cancel them and email students) }
// The account is soft-deleted (status REMOVED), never erased, because classes, bookings and
// history still point to it. A removed student's seats in upcoming classes are released.
export const handler = handle(async (event) => {
  const admin = requireRole(event, ["ADMIN"]);
  const body = parseBody(event);

  return setAccountStatus({
    admin,
    userId: requiredInt(body, "user_id"),
    newStatus: "REMOVED",
    allowedFrom: ["ACTIVE", "SUSPENDED", "PENDING", "REJECTED"],
    reason: optionalString(body, "reason", { max: 500 }),
    cancelClasses: optionalBool(body, "cancel_classes"),
    releaseBookings: true,
  });
});
