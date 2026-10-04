import pg from "pg";

// Return BIGINT (int8) columns as JS numbers instead of strings (our IDs are small)
pg.types.setTypeParser(20, (v) => Number(v));

const timezone = process.env.APP_TIMEZONE ?? "UTC";

// Created once per Lambda container and reused across invocations
const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 1, // one connection per Lambda container, protects RDS from connection spikes
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 5_000,
  // Practice shortcut. For production, load the RDS CA bundle and verify the certificate.
  ssl: { rejectUnauthorized: false },
  // Session settings sent when the connection starts (no extra queries needed)
  options: `-c search_path=coaching,public -c timezone=${timezone}`,
});

pool.on("error", (err) => console.error("Idle DB client error", err));

export async function query(text, params = []) {
  const { rows } = await pool.query(text, params);
  return rows;
}

// Postgres error code for UNIQUE constraint violations (e.g. duplicate email)
export const isUniqueViolation = (err) => err?.code === "23505";

// Only show classes that haven't ended yet.
// Set SHOW_PAST=true while testing, since the seed data has fixed dates.
// Queries using this must alias the classes table as "cl".
export const UPCOMING =
  process.env.SHOW_PAST === "true" ? "TRUE" : "cl.end_time > now()";
