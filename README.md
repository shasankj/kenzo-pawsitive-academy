# Kenzo Pawsitive Academy 🐾

A class-booking app for a (dog) training academy. Pups browse courses, pick an exact seat on a cinema-style seat map, and get a confirmation email. Trainers publish courses and cancel their own classes. The Head Dog (admin) approves signups and manages users, courses and classrooms.

It is a **React single-page app** talking to a **serverless AWS backend** (API Gateway + Lambda + PostgreSQL + DynamoDB + SNS/SQS/SES).

```
┌────────────┐   HTTPS/JSON    ┌─────────────┐   ┌──────────────────────────┐
│ React SPA  │ ──────────────▶ │ API Gateway │──▶│ Lambda functions (Node)  │
│ (Vite)     │  Bearer JWT     │  /development│  │  backend/functions/*.js  │
└────────────┘                 └─────────────┘   └───┬──────────┬───────────┘
                                                     │          │
                              RDS PostgreSQL ◀───────┘          └──────▶ DynamoDB (SeatBookings)
                              users, courses, classrooms,               seat locks, one item per seat
                              classes, enrollments                      │
                                                                        ▼
                                          SNS topic ──▶ SQS queue ──▶ sendEmails Lambda ──▶ SES
```

## Roles

| Role (UI name) | DB role | Can do |
|---|---|---|
| Pup | `STUDENT` | Browse/filter courses, pick a seat and book, view and see cancelled bookings |
| Trainer | `TEACHER` | Create courses, see own upcoming classes, cancel own classes |
| Head Dog | `ADMIN` | Approve/reject signups, add trainers/pups/courses/classrooms, suspend/remove/reactivate users, cancel any class or course |

Anyone can sign up as a Pup or Trainer. New accounts are `PENDING` and cannot log in until an admin approves them. Admins cannot be created through signup.

## Tech stack

**Frontend** (`frontend/`)
- React 19, React Router 7, Vite 8
- Framer Motion (page transitions), lucide-react (icons), plain CSS (`styles.css`)
- State via React Context (`auth.jsx`, `catalog.jsx`, `toast.jsx`), no state library
- Session (JWT) kept in `localStorage`

**Backend** (`backend/`)
- Node.js (ES modules), one Lambda per endpoint in `functions/`, shared code in `shared/`
- `pg` for PostgreSQL (RDS), `jsonwebtoken` for auth, AWS SDK v3 for DynamoDB, SNS and SES
- Passwords hashed with scrypt (`node:crypto`), JWTs signed HS256, 1 hour lifetime
- PostgreSQL schema `coaching`: exclusion constraints stop a room or teacher being double-booked
- DynamoDB table `SeatBookings`: conditional transactional writes make seat booking race-safe
- Email pipeline: Lambda publishes event to SNS, SQS queue, `sendEmails` Lambda sends via SES (plain text)

**API contract**: `coaching-development-swagger.json` (exported from API Gateway). `backend/models.json` and `backend/create_models.py` create the request/response models in API Gateway.

## Project layout

```
.
├── coaching-development-swagger.json   API Gateway export (Swagger 2.0)
├── backend/
│   ├── functions/     one Lambda handler per endpoint (login.js, book.js, ...)
│   ├── shared/        db, auth (JWT), http helpers/validation, password, events, bookings, users, cancellations
│   ├── sql/           rds_Script.sql (base schema+seed), 04_auth_and_approval.sql, cancel_suspend.sql
│   ├── scripts/hashPassword.js   generate a password hash for the first admin
│   ├── models.json, create_models.py   API Gateway models
└── frontend/
    ├── src/
    │   ├── api.js            all HTTP calls, session storage, 401 handling
    │   ├── auth.jsx          login/logout context
    │   ├── catalog.jsx       courses/classes/teachers/rooms/bookings context
    │   ├── pages/            AuthPage, Discover, CourseDetail, MyBookings, Studio, Admin
    │   └── components/       Layout, SeatMap, CourseCard, Forms, Dialogs, ManageUsers, ...
    └── vite.config.js        dev proxy to API Gateway
```

## API overview

Public: `POST /signup`, `POST /login`, `GET /getCourses`, `/getTeachers`, `/getClassrooms`, `/getClasses`, `/getClassAvailability/{class_id}`.
Any logged-in user: `POST /changePassword`.
STUDENT: `POST /book`, `GET /myBookings`.
TEACHER/ADMIN: `POST /addCourse`, `POST /cancelClass` (teachers only for their own classes).
ADMIN: `GET /pendingSignups`, `POST /reviewSignup`, `/addTeacher`, `/addStudent`, `/addClassroom`, `/cancelCourse`, `/suspendUser`, `/removeUser`, `/reactivateUser`.

Errors are always `{ "error": "CODE", "message": "..." }`. Protected endpoints take `Authorization: Bearer <token>`.

## Running the app

### Frontend only (quickest)

Requires Node 18+.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

In dev, requests go to `/api`, which Vite proxies to the deployed API Gateway (`/development` stage) configured in `vite.config.js`. The deployed API does not send CORS headers on real responses, so the proxy is required locally.

To point at a different API, set `VITE_API_BASE` (for example in `frontend/.env.local`):

```
VITE_API_BASE=https://<api-id>.execute-api.<region>.amazonaws.com/<stage>
```

Other commands: `npm run build` (output in `dist/`), `npm run preview`.

You need an existing **ACTIVE** account to log in. Sign up in the UI, then have an admin approve you (or create the first admin, below).

### Backend (your own AWS account)

There is no local backend runner or infrastructure-as-code. Backend setup is manual in AWS:

1. **Database.** Create an RDS PostgreSQL instance. As the master user run, in order:
   1. `backend/sql/rds_Script.sql` (extension, tables, constraints, seed data; the seed classes are dated 2026-10-05 to 2026-10-08)
   2. `backend/sql/04_auth_and_approval.sql` (ADMIN role, password/status columns, `app_writer` DB role). Replace the placeholder password and database name first.
   3. `backend/sql/cancel_suspend.sql` (suspend/remove, class and course cancellation)
2. **First admin.** `cd backend && node scripts/hashPassword.js 'YourStrongPassword'`, then insert an ADMIN row with that hash (template at the bottom of `04_auth_and_approval.sql`).
3. **DynamoDB.** Create table `SeatBookings` with partition key `class_id` (String), sort key `sk` (String), TTL attribute `expires_at`, and a GSI for looking up a student's bookings (name in `BOOKINGS_STUDENT_INDEX`; see `shared/bookings.js` for the key schema it expects).
4. **Messaging.** Create an SNS topic, subscribe an SQS queue (raw message delivery), verify a sender identity in SES (sandbox needs verified recipients too).
5. **Lambdas.** `cd backend && npm install`, deploy each file in `functions/` (with `shared/` bundled) as a Node.js Lambda, 512 MB+ for functions that hash passwords. Put the DB-using Lambdas in the VPC. Set `sendEmails` to trigger from the SQS queue with "Report batch item failures" on.
6. **API Gateway.** Create a REST API with a route per function. Optionally run `python3 backend/create_models.py --api-id <id> --dry-run` in CloudShell to attach models, then deploy to a stage.

#### Lambda environment variables

| Variable | Used by | Notes |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | DB functions | Prefer Secrets Manager over plain env vars |
| `JWT_SECRET` | login + all protected functions | Random, 32+ characters |
| `BOOKINGS_TABLE` | booking functions | Default `SeatBookings` |
| `BOOKINGS_STUDENT_INDEX` | `myBookings` | GSI name |
| `EVENTS_TOPIC_ARN` | functions that send notifications | If unset, events are skipped and logged |
| `FROM_EMAIL` | `sendEmails` | Verified SES identity |
| `APP_TIMEZONE` | DB + email | Default `UTC` |
| `SHOW_PAST` | list/book functions | `true` shows and allows past classes (testing only) |
| `REQUIRE_ENROLLMENT` | `book` | `true` requires an enrollment row |

## Walkthrough

1. **Sign up / log in** (`/auth`). Choose Pup or Trainer, submit. You see "awaiting approval". Logging in before approval returns `PENDING_APPROVAL`.
2. **Head Dog approves** (`/admin`). The pending-signups list has approve/reject buttons. The user gets an email either way.
3. **Pup discovers classes** (`/`). Courses are shown as cards, filterable by trainer, room and day. Only upcoming, scheduled classes appear.
4. **Pup books a seat** (`/courses/:id`). Pick a class, then a seat on the room grid (rows are letters, columns numbers, e.g. B3). Taken seats are disabled. Booking is atomic: if someone grabs the seat first you get "That seat was just taken". One seat per class per pup. A confetti burst and a confirmation email follow.
5. **Pup checks bookings** (`/bookings`). Upcoming bookings, with cancelled classes marked as such.
6. **Trainer's studio** (`/studio`). Create a course, see your upcoming classes, cancel one with an optional reason. Every pup with a booking is emailed.
7. **Head Dog management** (`/admin`). Add trainers, pups, courses and classrooms (seat grid size), suspend/remove/reactivate users (soft delete, history is kept), cancel classes or whole courses.
8. **Session handling.** Tokens last 1 hour. An expired or rejected token on an authenticated request signs you out and returns you to `/auth`.

## Known limitations

- The deployed API returns CORS headers only on `OPTIONS`, so a production build calling it directly is blocked by browsers until Lambdas return `Access-Control-Allow-Origin` or the app is served behind a same-origin proxy (e.g. CloudFront).
- `sendEmails.js` imports `@aws-sdk/client-sesv2`, which is not listed in `backend/package.json`.
- Swagger documents `/cancelCourse` with a `class_id` body; the handler and frontend use `course_id`.
- No automated tests, linter, CI, or infrastructure-as-code yet. See [CLAUDE.md](CLAUDE.md) for the standards to adopt.
