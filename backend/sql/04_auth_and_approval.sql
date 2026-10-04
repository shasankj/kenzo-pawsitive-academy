-- Run as the admin (master) user, connected to your database.
SET search_path TO coaching, public;

-- 1. Allow the ADMIN role.
--    If the next statement reports that the constraint doesn't exist and an ADMIN insert
--    later fails, find the real name with:
--      SELECT conname FROM pg_constraint WHERE conrelid = 'coaching.users'::regclass AND contype = 'c';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
    ADD CONSTRAINT users_role_check CHECK (role IN ('STUDENT', 'TEACHER', 'ADMIN'));

-- 2. Password hash + approval workflow columns.
--    password_hash holds a salted scrypt hash (never the password itself).
--    Existing users are backfilled as ACTIVE; they have no password until you set one.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS status        VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS reviewed_by   BIGINT REFERENCES users (user_id),
    ADD COLUMN IF NOT EXISTS reviewed_at   TIMESTAMPTZ;

ALTER TABLE users
    ADD CONSTRAINT users_status_check
    CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'DISABLED'));

-- Safer default for any row inserted without an explicit status
ALTER TABLE users ALTER COLUMN status SET DEFAULT 'PENDING';

-- Fast lookup for the admin's pending-signups list
CREATE INDEX IF NOT EXISTS idx_users_pending ON users (created_at) WHERE status = 'PENDING';

-- 3. A second database role for the Lambdas that write data or handle logins.
--    The existing read-only app_user stays for the list/availability APIs.
CREATE ROLE app_writer LOGIN PASSWORD 'replace-with-a-different-strong-password';

GRANT CONNECT ON DATABASE your_db_name TO app_writer;
GRANT USAGE ON SCHEMA coaching TO app_writer;
GRANT SELECT ON ALL TABLES IN SCHEMA coaching TO app_writer;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA coaching TO app_writer;

-- It can add users, courses and classrooms...
GRANT INSERT ON coaching.users, coaching.courses, coaching.classrooms TO app_writer;
-- ...and approve or reject signups, but cannot change roles, emails or passwords.
GRANT UPDATE (status, reviewed_by, reviewed_at) ON coaching.users TO app_writer;

ALTER ROLE app_writer SET search_path TO coaching, public;

-- 4. Create the first admin (there is no other way to get one).
--    Generate the hash on your machine:  node scripts/hashPassword.js 'YourStrongPassword'
--    Then replace the placeholders below and run the statement.
-- INSERT INTO coaching.users (name, email, role, status, password_hash)
-- VALUES ('Shasank Jabade', 'shasank306@gmail.com', 'ADMIN', 'ACTIVE', 'scrypt$16384$8$5$+YcVn8/Mf8hbParFossiiA==$CYyj1opvfoQ+I6aBUciEGDX7WWThU5G4Bod0gLPpWJGJhCg/3Cu+6He5n/J5DrYfwzsloz7cSREZbVSW/zoQxg==');
