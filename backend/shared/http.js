export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Lets a handler return a non-200 success, e.g. `return created({ ... })`
class Reply {
  constructor(status, body) {
    this.status = status;
    this.body = body;
  }
}
export const created = (body) => new Reply(201, body);

// ALLOWED_ORIGIN is the real frontend origin (e.g. https://dxxxx.cloudfront.net), never "*".
// API Gateway's "Enable CORS" only covers OPTIONS; with Lambda proxy integration the
// real responses must carry the header themselves.
const corsHeaders = () =>
  process.env.ALLOWED_ORIGIN
    ? { "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN, Vary: "Origin" }
    : {};

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", ...corsHeaders() },
  body: JSON.stringify(body),
});

// Wraps a handler: returns 200 (or the Reply status) with the result, maps HttpError
// to its status, and turns anything unexpected into a generic 500
// (details go to CloudWatch only).
export const handle = (fn) => async (event) => {
  try {
    const result = await fn(event);
    return result instanceof Reply ? json(result.status, result.body) : json(200, result);
  } catch (err) {
    if (err instanceof HttpError) {
      return json(err.status, { error: err.code, message: err.message });
    }
    console.error(err);
    return json(500, { error: "INTERNAL_ERROR", message: "Something went wrong" });
  }
};

// ---------- Query / path parameters ----------

// Optional positive-integer query/path parameter. Returns null when absent.
export function optionalId(params, name) {
  const raw = params?.[name];
  if (raw === undefined || raw === "") return null;
  if (!/^\d+$/.test(raw)) {
    throw new HttpError(400, "INVALID_PARAMETER", `${name} must be a positive integer`);
  }
  return Number(raw);
}

export function requiredId(params, name) {
  const value = optionalId(params, name);
  if (value === null) {
    throw new HttpError(400, "INVALID_PARAMETER", `${name} is required`);
  }
  return value;
}

// Optional YYYY-MM-DD date parameter. Returns null when absent.
export function optionalDate(params, name) {
  const raw = params?.[name];
  if (raw === undefined || raw === "") return null;
  const d = new Date(`${raw}T00:00:00Z`);
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(raw) &&
    !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === raw;
  if (!valid) {
    throw new HttpError(400, "INVALID_PARAMETER", `${name} must be a valid date (YYYY-MM-DD)`);
  }
  return raw;
}

// ---------- JSON request bodies ----------

export function parseBody(event) {
  if (!event.body) {
    throw new HttpError(400, "INVALID_BODY", "Request body is required");
  }
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    const body = JSON.parse(raw);
    if (body === null || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new HttpError(400, "INVALID_BODY", "Body must be a valid JSON object");
  }
}

export function requiredString(body, name, { min = 1, max = 255 } = {}) {
  const v = body[name];
  const trimmed = typeof v === "string" ? v.trim() : "";
  if (trimmed.length < min || trimmed.length > max) {
    throw new HttpError(400, "INVALID_PARAMETER", `${name} is required (${min}-${max} characters)`);
  }
  return trimmed;
}

// Returns null when absent or empty
export function optionalString(body, name, { max = 2000 } = {}) {
  const v = body[name];
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || v.trim().length > max) {
    throw new HttpError(400, "INVALID_PARAMETER", `${name} must be text up to ${max} characters`);
  }
  return v.trim();
}

export function requiredInt(body, name, { min = 1, max = 1_000_000 } = {}) {
  const v = body[name];
  if (!Number.isInteger(v) || v < min || v > max) {
    throw new HttpError(400, "INVALID_PARAMETER", `${name} must be a whole number between ${min} and ${max}`);
  }
  return v;
}

// Optional true/false field. Returns false when absent.
export function optionalBool(body, name) {
  const v = body[name];
  if (v === undefined || v === null) return false;
  if (typeof v !== "boolean") {
    throw new HttpError(400, "INVALID_PARAMETER", `${name} must be true or false`);
  }
  return v;
}
