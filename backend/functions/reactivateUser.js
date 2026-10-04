import { handle, parseBody, requiredInt } from "../shared/http.js";
import { requireRole } from "../shared/auth.js";
import { setAccountStatus } from "../shared/accounts.js";

// POST /reactivateUser   (ADMIN only)
// Body: { "user_id": 12 }
// Restores a SUSPENDED account to ACTIVE. Removed accounts are not restored through the API.
export const handler = handle(async (event) => {
  const admin = requireRole(event, ["ADMIN"]);
  const body = parseBody(event);

  return setAccountStatus({
    admin,
    userId: requiredInt(body, "user_id"),
    newStatus: "ACTIVE",
    allowedFrom: ["SUSPENDED"],
    reason: null,
  });
});
