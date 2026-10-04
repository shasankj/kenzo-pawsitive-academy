-- Run as the admin (master) user, connected to your database.
-- Safe to run more than once.
SET search_path TO coaching, public;

-- 1. Accounts: SUSPENDED and REMOVED states, plus who changed the status, when and why.
--    Accounts are never deleted (classes, bookings and history refer to them), so "remove" is a soft delete.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users
    ADD CONSTRAINT users_status_check
    CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'DISABLED', 'SUSPENDED', 'REMOVED'));

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS status_reason     TEXT,
    ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status_changed_by BIGINT REFERENCES users (user_id);

-- 2. Classes: record who cancelled a class, when and why (the status column already exists).
ALTER TABLE classes
    ADD COLUMN IF NOT EXISTS cancelled_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_by  BIGINT REFERENCES users (user_id),
    ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- A cancelled class must free its room and teacher for other classes. Recreating these is harmless
-- if you already did it earlier.
ALTER TABLE classes DROP CONSTRAINT IF EXISTS no_classroom_overlap;
ALTER TABLE classes DROP CONSTRAINT IF EXISTS no_teacher_overlap;
ALTER TABLE classes
    ADD CONSTRAINT no_classroom_overlap
        EXCLUDE USING gist (classroom_id WITH =, tstzrange(start_time, end_time) WITH &&)
        WHERE (status = 'SCHEDULED'),
    ADD CONSTRAINT no_teacher_overlap
        EXCLUDE USING gist (teacher_id WITH =, tstzrange(start_time, end_time) WITH &&)
        WHERE (status = 'SCHEDULED');

-- 3. Courses: a status so a cancelled course stays on record but is retired.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_status_check;
ALTER TABLE courses
    ADD CONSTRAINT courses_status_check CHECK (status IN ('ACTIVE', 'CANCELLED'));

-- 4. Permissions for app_user. Column-level, so it can change only what these APIs need.
GRANT UPDATE (password_hash, status, status_reason, status_changed_at, status_changed_by)
    ON coaching.users TO app_user;
GRANT UPDATE (status, cancelled_at, cancelled_by, cancel_reason)
    ON coaching.classes TO app_user;
GRANT UPDATE (status)
    ON coaching.courses TO app_user;