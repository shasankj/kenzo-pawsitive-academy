import { query } from "../shared/db.js";
import { handle, parseBody, requiredString, optionalString, created } from "../shared/http.js";
import { requireRole } from "../shared/auth.js";

// POST /addCourse   (ADMIN or TEACHER)
// Body: { "title": "...", "subject": "...", "description": "..." (optional) }
export const handler = handle(async (event) => {
  requireRole(event, ["ADMIN", "TEACHER"]);
  const body = parseBody(event);

  const title = requiredString(body, "title", { max: 150 });
  const subject = requiredString(body, "subject", { max: 80 });
  const description = optionalString(body, "description", { max: 2000 });

  const [course] = await query(
    `INSERT INTO courses (title, description, subject)
     VALUES ($1, $2, $3)
     RETURNING course_id, title, description, subject`,
    [title, description, subject]
  );

  return created({ course });
});
