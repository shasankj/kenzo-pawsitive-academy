// Dev: same-origin '/api' (proxied by Vite, see vite.config.js). Prod: VITE_API_BASE, which is
// required at build time and needs the backend to return CORS headers on its responses.
const BASE = (import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? '/api' : '')).replace(/\/$/, '')

const STORE_KEY = 'pawsitive.session'

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code || `Request failed (${status})`)
    this.status = status
    this.code = code
  }
}

export function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY))
    if (!s?.token) return null
    if (s.expiresAt && Date.now() > s.expiresAt) return null
    return s
  } catch {
    return null
  }
}

export function saveSession(s) {
  try {
    if (s) localStorage.setItem(STORE_KEY, JSON.stringify(s))
    else localStorage.removeItem(STORE_KEY)
  } catch {
    /* storage unavailable – session lives in memory only */
  }
}

let unauthorizedHandler = () => {}
export const onUnauthorized = (fn) => {
  unauthorizedHandler = fn
  return () => { unauthorizedHandler = () => {} }
}

async function request(path, { method = 'GET', body, query, keepSession = false } = {}) {
  const url = new URL(BASE + path, window.location.origin)
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })

  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  const session = loadSession()
  if (session) headers.Authorization = `${session.tokenType || 'Bearer'} ${session.token}`

  let res
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
  } catch {
    throw new ApiError(0, 'NETWORK', "Can't reach the kennel. Check your connection and try again.")
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // A 401 on a request that carried a token means the session died.
    if (res.status === 401 && session && !keepSession && path !== '/login') unauthorizedHandler()
    throw new ApiError(res.status, data.error, data.message)
  }
  return data
}

const post = (path, body, opts) => request(path, { method: 'POST', body, ...opts })
// Optional free-text fields are omitted rather than sent empty.
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined))

export const api = {
  login: (email, password) => post('/login', { email, password }),
  signup: (b) => post('/signup', b),

  courses: (q) => request('/getCourses', { query: q }),
  teachers: (q) => request('/getTeachers', { query: q }),
  classrooms: (q) => request('/getClassrooms', { query: q }),
  classes: (q) => request('/getClasses', { query: q }),
  availability: (classId) => request(`/getClassAvailability/${classId}`),
  myBookings: () => request('/myBookings'),
  book: (class_id, row, col) => post('/book', { class_id, row, col }),

  pendingSignups: () => request('/pendingSignups'),
  reviewSignup: (user_id, decision) => post('/reviewSignup', { user_id, decision }),
  addTeacher: (b) => post('/addTeacher', b),
  addStudent: (b) => post('/addStudent', b),
  addCourse: (b) => post('/addCourse', b),
  addClassroom: (b) => post('/addClassroom', b),

  // A wrong current password may come back as 401 — that must not sign the user out.
  changePassword: (current_password, new_password) =>
    post('/changePassword', { current_password, new_password }, { keepSession: true }),
  cancelClass: (class_id, reason) => post('/cancelClass', clean({ class_id, reason })),
  // NOTE: swagger documents /cancelCourse with the CancelClassRequest body (class_id);
  // we send course_id, which is what the endpoint is named for.
  cancelCourse: (course_id, reason) => post('/cancelCourse', clean({ course_id, reason })),
  suspendUser: (b) => post('/suspendUser', clean(b)),
  removeUser: (b) => post('/removeUser', clean(b)),
  reactivateUser: (user_id) => post('/reactivateUser', { user_id }),
}
