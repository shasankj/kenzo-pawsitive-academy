const pad = (n) => String(n).padStart(2, '0')

// Accepts ISO strings ("2026-10-05T13:00:00.000Z") or time-only ("13:00:00") plus a date.
export function toDate(value, date) {
  if (!value) return null
  if (/^\d{1,2}:\d{2}/.test(value) && date) return new Date(`${date}T${value.slice(0, 8).padEnd(8, ':00')}`)
  const d = new Date(value)
  return isNaN(d) ? null : d
}

export const fmtTime = (d) =>
  d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'

export const fmtDay = (d, opts = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  d ? d.toLocaleDateString([], opts) : '—'

export const localISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function timeRange(cls) {
  const s = toDate(cls.start_time, cls.date)
  const e = toDate(cls.end_time, cls.date)
  return `${fmtTime(s)} – ${fmtTime(e)}`
}

// The class date as shown to the viewer (local time), falling back to the API's date field.
export function classDay(cls) {
  const s = toDate(cls.start_time, cls.date)
  return s ? localISODate(s) : cls.date
}

export const rowLetter = (row) => {
  let n = row, s = ''
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
export const seatLabel = (row, col) => `${rowLetter(row)}${col}`

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '🐶'

// Stable pleasant colour per subject / name.
const HUES = [18, 168, 262, 340, 42, 205, 95]
export function hueFor(str = '') {
  let h = 0
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return HUES[h % HUES.length]
}

export const SUBJECT_EMOJI = {
  art: '🎨', psychology: '🧠', sports: '🏅', music: '🎵', science: '🔬',
  math: '🧮', cooking: '🍖', food: '🍖', language: '💬', health: '💪',
}
export const subjectEmoji = (s = '') => SUBJECT_EMOJI[s.toLowerCase()] || '🦴'

export const ROLE_LABEL = { STUDENT: 'Pup', TEACHER: 'Trainer', ADMIN: 'Head Dog' }

export const isCancelled = (b) => /cancel/i.test(b?.status || '')
