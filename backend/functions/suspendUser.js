import { handle, parseBody, requiredInt, optionalString, optionalBool } from "../shared/http.js";
import { requireRole } from "../shared/auth.js";
import { setAccountStatus } from "../shared/accounts.js";

// POST /suspendUser   (ADMIN only; works for teachers and students)
// Body: { "user_id": 12, "reason": "..." (optional),
//         "cancel_classes": true     (teachers with upcoming classes: cancel them and email students),
//         "release_bookings": true   (students: free the seats they hold; default keeps them) }
// A suspended account can't log in. It can be restored with /reactivateUser.
export const handler = handle(async (event) => {
  const admin = requireRole(event, ["ADMIN"]);
  const body = parseBody(event);

  return setAccountStatus({
    admin,
    userId: requiredInt(body, "user_id"),
    newStatus: "SUSPENDED",
    allowedFrom: ["ACTIVE"],
    reason: optionalString(body, "reason", { max: 500 }),
    cancelClasses: optionalBool(body, "cancel_classes"),
    releaseBookings: optionalBool(body, "release_bookings"),
  });
});
