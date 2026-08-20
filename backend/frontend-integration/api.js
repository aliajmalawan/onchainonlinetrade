/**
 * Drop-in backend client for the React app.
 * Copy this file to  src/lib/backend.js  and use it to replace the
 * localStorage mock in storage.js / AuthContext.jsx.
 *
 * All calls return promises, so the components that used the sync
 * localStorage helpers need small async tweaks (await + loading state).
 */

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000/api'

function token() {
  return localStorage.getItem('ct.token')
}

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: 'Bearer ' + token() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// --- Auth ---
export async function apiRegister(payload) {
  const { token: t, user } = await request('/register.php', { method: 'POST', body: payload })
  localStorage.setItem('ct.token', t)
  return user
}

export async function apiLogin(email, password) {
  const { token: t, user } = await request('/login.php', { method: 'POST', body: { email, password } })
  localStorage.setItem('ct.token', t)
  return user
}

export async function apiLogout() {
  try { await request('/logout.php', { method: 'POST' }) } finally {
    localStorage.removeItem('ct.token')
  }
}

export async function apiMe() {
  if (!token()) return null
  try {
    const { user } = await request('/me.php')
    return user
  } catch {
    localStorage.removeItem('ct.token')
    return null
  }
}

// --- Portfolio ---
export const apiGetPortfolio = () => request('/portfolio.php').then((d) => d.holdings)
export const apiAddHolding   = (h) => request('/portfolio.php', { method: 'POST', body: h }).then((d) => d.holding)
export const apiRemoveHolding = (id) => request('/portfolio.php?id=' + id, { method: 'DELETE' })

// --- Admin ---
export const apiGetUsers    = () => request('/admin/users.php').then((d) => d.users)
export const apiUpdateRole  = (userId, role) => request('/admin/update_role.php', { method: 'POST', body: { userId, role } })
export const apiDeleteUser  = (userId) => request('/admin/delete_user.php', { method: 'POST', body: { userId } })