import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminRoute() {
  const { user } = useAuth()
  if (!user?.is_staff) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
