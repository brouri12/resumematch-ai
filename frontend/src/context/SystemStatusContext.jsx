import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from './AuthContext'

const SystemStatusContext = createContext({ status: null, refresh: () => {} })

export function SystemStatusProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [status, setStatus] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.systemStatus())
    } catch {
      setStatus(null)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, isAuthenticated])

  return (
    <SystemStatusContext.Provider value={{ status, refresh }}>{children}</SystemStatusContext.Provider>
  )
}

export function useSystemStatus() {
  return useContext(SystemStatusContext)
}
