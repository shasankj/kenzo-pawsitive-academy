import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, loadSession, onUnauthorized, saveSession } from './api'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession)

  const logout = useCallback(() => {
    saveSession(null)
    setSession(null)
  }, [])

  useEffect(() => onUnauthorized(logout), [logout])

  const login = useCallback(async (email, password) => {
    const r = await api.login(email, password)
    const s = {
      token: r.token,
      tokenType: r.token_type,
      expiresAt: r.expires_in ? Date.now() + r.expires_in * 1000 : null,
      user: { ...r.user, role: String(r.user?.role || '').toUpperCase() },
    }
    saveSession(s)
    setSession(s)
  }, [])

  const value = useMemo(
    () => ({ user: session?.user || null, login, logout }),
    [session, login, logout],
  )
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
