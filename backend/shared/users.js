import { query, isUniqueViolation } from "./db.js";
import { HttpError, requiredString } from "./http.js";
import { hashPassword } from "./password.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validates { name, email, password } from a request body
export function parseNewUser(body) {
  const name = requiredString(body, "name", { max: 100 });
  const email = requiredString(body, "email", { max: 255 }).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new HttpError(400, "INVALID_PARAMETER", "email is not valid");
  }

  const password = body.password;
  // The 128-character cap stops absurdly long inputs from burning CPU in the hash function
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw new HttpError(400, "INVALID_PARAMETER", "password must be 8-128 characters");
  }
  return { name, email, password };
}

// Inserts a user with a hashed password.
// status: "PENDING" for self signups, "ACTIVE" when an admin adds the user.
export async function createUser({ name, email, password, role, status, reviewedBy = null }) {
  const passwordHash = await hashPassword(password);
  try {
    const [user] = await query(
      `INSERT INTO users (name, email, role, status, password_hash, reviewed_by, reviewed_at)
       VALUES ($1, $2, $3, $4, $5, $6::bigint,
               CASE WHEN $6::bigint IS NULL THEN NULL ELSE now() END)
       RETURNING user_id, name, email, role, status, created_at`,
      [name, email, role, status, passwordHash, reviewedBy]
    );
    return user;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, "EMAIL_EXISTS", "An account with this email already exists");
    }
    throw err;
  }
}
