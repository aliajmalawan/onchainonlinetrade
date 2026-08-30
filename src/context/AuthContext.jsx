import { createContext, useContext, useEffect, useState } from 'react'
import { apiLogin, apiRegister, apiLogout, apiMe, apiAdminImpersonate, apiUpdateAccount } from '../lib/backend'

const AuthContext = createContext(null)
const ADMIN_TOKEN_KEY = 'ct.adminToken'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [impersonating, setImpersonating] = useState(() => !!localStorage.getItem(ADMIN_TOKEN_KEY))

  // Restore session on first load (validates the stored token against the API).
  useEffect(() => {
    apiMe()
      .then((found) => setUser(found))
      .catch((err) => {
        // Only a confirmed 401 means the token is genuinely invalid — a
        // network blip, 500, or CORS hiccup shouldn't clear it.
        if (err?.status === 401) localStorage.removeItem('ct.token')
      })
      .finally(() => setReady(true))
  }, [])

  async function login(email, password) {
    const found = await apiLogin(email, password)
    setUser(found)
    return found
  }

  async function register({ name, email, phone, password }) {
    const created = await apiRegister({ name, email, phone, password })
    setUser(created)
    return created
  }

  async function logout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    setImpersonating(false)
    await apiLogout()
    setUser(null)
  }

  // Admin support tool: open a target user's account without ever seeing
  // their password. The admin's own token is stashed so they can return.
  async function impersonate(userId) {
    const adminToken = localStorage.getItem('ct.token')
    const { token, user: target } = await apiAdminImpersonate(userId)
    localStorage.setItem(ADMIN_TOKEN_KEY, adminToken)
    localStorage.setItem('ct.token', token)
    setImpersonating(true)
    setUser(target)
    return target
  }

  async function updateAccount(name, email, phone) {
    const updated = await apiUpdateAccount(name, email, phone)
    setUser(updated)
    return updated
  }

  async function refreshUser() {
    try {
      const found = await apiMe()
      setUser(found)
      return found
    } catch (err) {
      // Only a confirmed 401 means the session is genuinely gone — anything
      // else (network blip, 500, CORS hiccup) shouldn't log out a page that
      // re-validates on every visit (Trade) over a single failed re-check.
      if (err?.status === 401) {
        localStorage.removeItem('ct.token')
        setUser(null)
        return null
      }
      return user
    }
  }

  async function returnToAdmin() {
    const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY)
    if (!adminToken) return
    localStorage.setItem('ct.token', adminToken)
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    setImpersonating(false)
    try {
      setUser(await apiMe())
    } catch (err) {
      if (err?.status === 401) localStorage.removeItem('ct.token')
    }
  }

  const value = {
    user,
    ready,
    isAdmin: user?.role === 'admin',
    impersonating,
    login,
    register,
    logout,
    updateAccount,
    refreshUser,
    impersonate,
    returnToAdmin,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
