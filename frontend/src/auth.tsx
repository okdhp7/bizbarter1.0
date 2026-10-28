import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getToken, setToken } from './api'
import type { User } from './types'

interface AuthCtx {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => void
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); return }
    try { setUser(await api<User>('/me')) } catch { setUser(null) }
  }, [])

  useEffect(() => { refresh().finally(() => setLoading(false)) }, [refresh])

  const login = async (email: string, password: string) => {
    const r = await api<{ access_token: string; user: User }>('/auth/login', { body: { email, password } })
    setToken(r.access_token)
    const me = await api<User>('/me')
    setUser(me)
    return me
  }
  const logout = () => { setToken(null); setUser(null) }

  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
