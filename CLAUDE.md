# CLAUDE.md

Guidance for working in this repo. Read [README.md](README.md) first for architecture and setup.

## Project at a glance

- `frontend/`: React 19 + Vite SPA (JavaScript, ES modules, no TypeScript, no tests yet).
- `backend/`: AWS Lambda handlers (Node, ES modules). One file per endpoint in `functions/`, shared code in `shared/`.
- Data: PostgreSQL schema `coaching` (source of truth for users/courses/rooms/classes), DynamoDB `SeatBookings` (seat locks), SNS to SQS to SES for email.
- API contract: `coaching-development-swagger.json`. Keep it, `backend/models.json`, `backend/create_models.py` and `frontend/src/api.js` in sync when an endpoint changes.

## Commands

```bash
cd frontend && npm install && npm run dev     # dev server on :5173, proxies /api to API Gateway
cd frontend && npm run build                  # production build to dist/
cd backend && npm install                     # deps for Lambdas; there is no local runner
node backend/scripts/hashPassword.js '<pw>'   # generate a scrypt hash
```

There are no test, lint or typecheck scripts yet. When adding them, add the commands here and run them before declaring work done.

## Working rules

- Match surrounding code: naming, comment density, file structure. Don't reformat files you aren't changing.
- Make the smallest change that solves the problem. No speculative abstractions, no drive-by refactors.
- Never commit secrets, `.env` files, DB passwords, JWT secrets or real password hashes. Use environment variables or AWS Secrets Manager.
- Don't edit `node_modules/` or `frontend/dist/`.
- Before deleting or overwriting data, SQL objects or AWS resources, look at what is there and confirm with the user.
- Verify your work: run the build, exercise the changed path, and report honestly what you could not verify.

## Backend rules (Lambda)

**Handler shape.** Every handler is `export const handler = handle(async (event) => { ... })` from `shared/http.js`. Throw `HttpError(status, "CODE", "message")` for expected failures. Never return raw errors; unexpected errors become a generic 500 and are logged to CloudWatch only.

**Auth.**
- Call `requireRole(event, [...])` first in every protected handler. Public endpoints must be a deliberate decision, noted in the handler's header comment.
- Identity comes from the verified JWT, never from the request body (`/book` takes the student from the token).
- JWTs are valid for 1 hour, so a suspended or removed user keeps a valid token. Re-check `users.status = 'ACTIVE'` in the database in any write handler that matters (as `book.js` does).
- Role checks are not enough for ownership: a TEACHER may only touch their own classes (see `cancelClass.js`).

**Validation.** Validate all input with the helpers in `shared/http.js` (`requiredString`, `requiredInt`, `optionalId`, ...). Set max lengths. Reject unknown enum values explicitly.

**SQL.**
- Always parameterized (`$1, $2`). Never interpolate user input. The only interpolated fragments are fixed constants written in code (e.g. `UPCOMING`, cancellation conditions).
- Rely on database constraints for invariants (unique email, no room/teacher overlap, role FKs) and map violations with `isUniqueViolation` or the constraint's error code to a 409.
- Schema changes go in a new numbered, idempotent file in `backend/sql/` (`IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`). Never edit a script that has already been run.
- Use least-privilege DB roles and column-level `GRANT`s. A function gets the role with the fewest rights it needs.
- Accounts, classes and courses are soft-deleted via `status`; history must stay intact.

**Concurrency.** Seat booking correctness lives in the DynamoDB `TransactWriteCommand` with conditional puts. Don't replace it with read-then-write. Postgres validates the class; DynamoDB owns the seat.

**Passwords.** scrypt only, through `shared/password.js`. Keep constant-time comparison and the dummy hash on unknown-email logins. Never log passwords, tokens or hashes. Don't log email addresses.

**Notifications.** Use `publishEvent` (best effort, never fails the request). Events must carry everything the email needs, so `sendEmails` never queries the DB. Email is plain text, and every user-supplied value goes through `oneLine`.

**Connections and timeouts.** The pg pool is `max: 1` per Lambda container; keep it. Keep short client timeouts on AWS SDK calls so a missing network route fails fast.

**Production hardening still owed** (do not regress, and fix when touching these):
- `shared/db.js` uses `ssl: { rejectUnauthorized: false }`. Load the RDS CA bundle and verify the certificate.
- Return CORS headers (`Access-Control-Allow-Origin`, restricted to the real frontend origin) from real responses, not just `OPTIONS`.
- `SHOW_PAST` and `REQUIRE_ENROLLMENT` are testing toggles. `SHOW_PAST` must be unset in production.
- Add `@aws-sdk/client-sesv2` to `backend/package.json`, add rate limiting or throttling on `/login` and `/signup` (API Gateway usage plans/WAF), and a dead-letter queue on the email SQS queue.
- Move DB credentials and `JWT_SECRET` to Secrets Manager. Plan secret rotation.

## Frontend rules (React)

- All network access goes through `src/api.js`. Never call `fetch` from components. Add new endpoints there, one function each.
- Auth state is in `auth.jsx`, shared data in `catalog.jsx`. Reuse them rather than adding parallel state. Prefer Context plus local state; don't add a state library without a reason.
- Route protection uses `<Guard roles={[...]}>` in `App.jsx`. This is UX only. The backend is the real authorization boundary, so never rely on the UI hiding a button.
- Handle every async call's loading, empty and error states. Show `ApiError.message` to users; it is already friendly. Disable buttons while a request is in flight.
- The `localStorage` token is readable by any script on the page: no `dangerouslySetInnerHTML`, no untrusted HTML, keep dependencies minimal and audited.
- Dates come from the API as ISO strings. Use helpers in `src/util.js` (`toDate`, `fmtDay`, `timeRange`) instead of ad hoc formatting.
- Components stay small and in `components/`; one page per route in `pages/`. Style with the existing CSS variables and classes in `styles.css`.
- Accessibility: real `<button>`s and labels, keyboard-operable seat map, sufficient contrast, `aria-*` on custom controls, respect `prefers-reduced-motion` for animations.
- Config via `VITE_*` env vars only (they are public). Never put a secret in frontend code. The hard-coded API URL in `api.js` and `vite.config.js` should move to env config for each environment.

## Production-readiness standards

**Security**
- Principle of least privilege everywhere: IAM roles per Lambda (only the table, topic and identity it needs), DB roles per function group.
- Validate on the server, encode on output, never trust the client.
- Dependencies: run `npm audit` regularly, pin via lockfiles, review new packages before adding.
- No PII or secrets in logs. Return generic messages for auth failures (don't reveal whether an account exists).

**Reliability**
- Handlers should be safe to retry. Use idempotency (conditional writes, unique constraints) rather than assuming one delivery.
- Fail fast with timeouts. Use DLQs for async paths. Alarm on Lambda errors, 5xx rate, SQS queue age and DLQ depth.
- Structured JSON logs (`console.log(JSON.stringify({ msg, ... }))`) with an event ID or request ID for tracing.

**Quality**
- Add tests with new logic: unit tests for `shared/` helpers and handlers (mock `query`, DynamoDB, SNS), and component or Playwright tests for booking, login and cancellation flows. Bug fixes get a regression test.
- Add ESLint and Prettier, run in CI. CI should run install, lint, test and `vite build` on every PR.
- Use git with small, focused commits and PRs. Commit messages explain why.

**Deployment and operations**
- Move infrastructure into code (AWS SAM, CDK or Terraform): RDS, DynamoDB, SNS/SQS, SES, Lambdas, API Gateway, IAM. Keep separate dev and prod stages and accounts or stacks.
- Deploy the frontend as static files (S3 + CloudFront) with the API behind the same origin, or with proper CORS.
- Back up RDS (automated backups, tested restore), and enable DynamoDB point-in-time recovery for non-expired data.
- Migrations are forward-only, numbered, idempotent and tested on a copy first.

## Don'ts

- Don't bypass `requireRole`, validation helpers or `handle`.
- Don't build SQL with string concatenation of request data.
- Don't create admin accounts through any public path.
- Don't hard-delete users, classes or courses.
- Don't commit seeded real credentials. Note: the commented admin INSERT in `backend/sql/04_auth_and_approval.sql` contains a real email and password hash. Remove it from the repo and rotate that password.
