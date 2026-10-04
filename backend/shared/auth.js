import jwt from "jsonwebtoken";
import { HttpError } from "./http.js";

const TOKEN_LIFETIME_SECONDS = 3600; // 1 hour

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error("JWT_SECRET must be set to a random string of at least 32 characters");
  }
  return s;
}

export function signToken(user) {
  return jwt.sign({ role: user.role, name: user.name }, secret(), {
    subject: String(user.user_id),
    expiresIn: TOKEN_LIFETIME_SECONDS,
    algorithm: "HS256",
  });
}

export const TOKEN_EXPIRES_IN = TOKEN_LIFETIME_SECONDS;

// Call at the top of any protected handler. Returns the caller's identity,
// or throws 401 (not logged in) / 403 (wrong role).
//   const admin = requireRole(event, ["ADMIN"]);
//   admin.userId, admin.role, admin.name
export function requireRole(event, allowedRoles) {
  const header = event.headers?.authorization ?? event.headers?.Authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "UNAUTHORIZED", "Missing or invalid Authorization header");
  }

  let claims;
  try {
    claims = jwt.verify(token, secret(), { algorithms: ["HS256"] });
  } catch {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid or expired token");
  }

  if (!allowedRoles.includes(claims.role)) {
    throw new HttpError(403, "FORBIDDEN", "You don't have permission to do this");
  }
  return { userId: Number(claims.sub), role: claims.role, name: claims.name };
}
