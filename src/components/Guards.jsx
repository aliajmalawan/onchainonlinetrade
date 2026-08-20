import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Requires any logged-in user.
export function ProtectedRoute({ children }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return null
  if (!user) {
    const loginPath = location.pathname.startsWith('/admin') ? '/admin' : '/login'
    return <Navigate to={loginPath} state={{ from: location }} replace />
  }
  return children
}

// Requires an admin.
export function AdminRoute({ children }) {
  const { user, ready, isAdmin } = useAuth()
  if (!ready) return null
  if (!user) return <Navigate to="/admin" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return children
}
