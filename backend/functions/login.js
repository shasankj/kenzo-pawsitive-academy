import { query } from "../shared/db.js";
import { handle, parseBody, requiredString, HttpError } from "../shared/http.js";
import { verifyPassword, dummyHash } from "../shared/password.js";
import { signToken, TOKEN_EXPIRES_IN } from "../shared/auth.js";

// POST /login   (public)
// Body: { "email": "...", "password": "..." }
// Returns: { token, token_type: "Bearer", expires_in, user }
// Send the token on later requests as:  Authorization: Bearer <token>
export const handler = handle(async (event) => {
  const body = parseBody(event);
  const email = requiredString(body, "email", { max: 255 }).toLowerCase();
  const password = body.password;
  if (typeof password !== "string" || password.length === 0 || password.length > 128) {
    throw new HttpError(400, "INVALID_PARAMETER", "password is required");
  }

  const [user] = await query(
    `SELECT user_id, name, role, status, password_hash
       FROM users
      WHERE lower(email) = $1`,
    [email]
  );

  // Always run one hash check, even for unknown emails, so response time
  // doesn't reveal whether an account exists.
  const passwordOk = await verifyPassword(password, user?.password_hash ?? (await dummyHash()));
  if (!user || !user.password_hash || !passwordOk) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Incorrect email or password");
  }

  // Status is only revealed after the password is verified
  if (user.status === "PENDING") {
    throw new HttpError(403, "PENDING_APPROVAL", "Your account is awaiting admin approval");
  }
  if (user.status !== "ACTIVE") {
    throw new HttpError(403, "ACCOUNT_UNAVAILABLE", "This account can't be used to sign in");
  }

  return {
    token: signToken(user),
    token_type: "Bearer",
    expires_in: TOKEN_EXPIRES_IN,
    user: { user_id: user.user_id, name: user.name, role: user.role },
  };
});
