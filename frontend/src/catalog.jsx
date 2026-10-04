import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import { isCancelled, toDate } from './util'

const Ctx = createContext(null)
export const useCatalog = () => useContext(Ctx)

export function CatalogProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState({ courses: [], classes: [], teachers: [], classrooms: [] })
  const [bookings, setBookings] = useState({ count: 0, courses: [], bookings: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const [c, cl, t, r] = await Promise.all([
        api.courses(), api.classes(), api.teachers(), api.classrooms(),
      ])
      setState({
        courses: c.courses || [], classes: cl.classes || [],
        teachers: t.teachers || [], classrooms: r.classrooms || [],
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshBookings = useCallback(async () => {
    try {
      const b = await api.myBookings()
      setBookings({ count: b.count || 0, courses: b.courses || [], bookings: b.bookings || [] })
    } catch { /* not every role has bookings */ }
  }, [])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    refresh()
    refreshBookings()
  }, [user, refresh, refreshBookings])

  const value = useMemo(() => {
    const now = Date.now()
    const isUpcoming = (c) => (toDate(c.end_time, c.date) || toDate(c.start_time, c.date) || 0) > now
    const upcoming = state.classes
      .filter(isUpcoming)
      .sort((a, b) => toDate(a.start_time, a.date) - toDate(b.start_time, b.date))
    const classesByCourse = new Map()
    upcoming.forEach((c) => {
      const k = c.course?.course_id
      classesByCourse.set(k, [...(classesByCourse.get(k) || []), c])
    })
    const mySeatsByClass = new Map()
    bookings.bookings.filter((b) => !isCancelled(b)).forEach((b) => {
      mySeatsByClass.set(b.class_id, [...(mySeatsByClass.get(b.class_id) || []), b.seat])
    })
    return {
      ...state, upcoming, classesByCourse, bookings, mySeatsByClass,
      activeBookings: bookings.bookings.filter((b) => !isCancelled(b)),
      loading, error, refresh, refreshBookings,
    }
  }, [state, bookings, loading, error, refresh, refreshBookings])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
