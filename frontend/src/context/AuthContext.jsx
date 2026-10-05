import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, clearTokens, getAccessToken, setTokens } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null)
      setLoading(false)
      return null
    }
    try {
      const me = await api.me()
      setUser(me)
      return me
    } catch {
      clearTokens()
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = async (username, password) => {
    const tokens = await api.login({ username, password })
    setTokens(tokens)
    const me = await api.me()
    setUser(me)
    return me
  }

  const register = async (payload) => {
    await api.register(payload)
    return login(payload.username, payload.password)
  }

  const logout = () => {
    clearTokens()
    setUser(null)
  }

  const updateProfile = async (payload) => {
    const me = await api.updateMe(payload)
    setUser(me)
    return me
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, updateProfile, refreshUser, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
