import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

// scrypt cost settings (N=2^14, r=8, p=5 is an OWASP-recommended combination, ~16 MB of memory).
// They are stored inside each hash, so you can raise them later without breaking old passwords.
// Give the Lambdas that hash or verify passwords at least 512 MB of memory so this runs quickly.
const PARAMS = { N: 16384, r: 8, p: 5 };
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

// Stored format: scrypt$N$r$p$salt(base64)$hash(base64)
export async function hashPassword(password) {
  const salt = randomBytes(16); // unique random salt per password
  const key = await scryptAsync(password, salt, KEY_LENGTH, { ...PARAMS, maxmem: MAX_MEMORY });
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(password, stored) {
  const [scheme, N, r, p, saltB64, hashB64] = (stored ?? "").split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;

  const expected = Buffer.from(hashB64, "base64");
  const key = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: MAX_MEMORY,
  });
  return timingSafeEqual(key, expected); // constant-time comparison
}

// Used by login so that an unknown email takes about as long as a wrong password
let dummy;
export async function dummyHash() {
  dummy ??= await hashPassword(randomBytes(12).toString("hex"));
  return dummy;
}
