/* ============================================================
   backend.js — client for the PHP + MySQL backend (./backend).
   Replaces the localStorage mock in storage.js / AuthContext.jsx.
   ============================================================ */

const BASE = import.meta.env.VITE_BACKEND_URL || '/api'

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
export const apiAddHolding = (h) => request('/portfolio.php', { method: 'POST', body: h })
export const apiRemoveHolding = (id, opts) => request('/portfolio.php?id=' + id, { method: 'DELETE', body: opts })
export const apiGetTradeHistory = () => request('/trade_history.php').then((d) => d.trades)
export const apiConvert = (payload) => request('/convert.php', { method: 'POST', body: payload })
export const apiGetWithdrawHistory = () => request('/withdraw_history.php').then((d) => d.withdraws)
export const apiSubmitWithdrawRequest = (payload) => request('/withdraw_request.php', { method: 'POST', body: payload })
export const apiGetDepositHistory = () => request('/deposit_history.php').then((d) => d.deposits)
export async function apiSubmitDepositRequest({ currency, network, amount, txId, proofFile }) {
  const ROOT = (import.meta.env.VITE_BACKEND_URL || '/api').replace(/\/api$/, '')
  const url = ROOT + '/api/deposit_request.php'
  const fd = new FormData()
  fd.append('currency', currency)
  fd.append('network', network)
  fd.append('amount', amount)
  fd.append('txId', txId)
  if (proofFile) fd.append('proof', proofFile)

  const headers = {}
  const t = localStorage.getItem('ct.token')
  if (t) headers['Authorization'] = 'Bearer ' + t

  const res = await fetch(url, { method: 'POST', headers, body: fd })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data.deposit
}
export const apiGetDepositAddresses = () => request('/deposit_addresses.php').then((d) => d.addresses)

// --- Account ---
export const apiUpdatePassword = (currentPassword, newPassword) => request('/update_password.php', { method: 'POST', body: { currentPassword, newPassword } })
export const apiUpdateAccount  = (name, email, phone) => request('/update_account.php', { method: 'POST', body: { name, email, phone } }).then((d) => d.user)

// --- Support chat ---
export const apiGetSupportChat  = () => request('/support_chat.php').then((d) => d.messages)
export const apiSendSupportChat = (message) => request('/support_chat.php', { method: 'POST', body: { message } }).then((d) => d.message)

export const apiGetNotifications = () => request('/notifications.php').then((d) => d.notifications)
export const apiMarkNotificationRead = (id) => request('/notifications.php', { method: 'POST', body: { id } })

// --- Admin ---
export const apiGetUsers    = () => request('/admin/users.php').then((d) => d.users)
export const apiDeleteUser  = (userId) => request('/admin/delete_user.php', { method: 'POST', body: { userId } })
export const apiAdminAddHolding = (userId, h) => request('/admin/add_holding.php', { method: 'POST', body: { userId, ...h } }).then((d) => d.holding)
export const apiAdminGetUserHoldings = (userId) => request('/admin/user_holdings.php?userId=' + userId).then((d) => d.holdings)
export const apiAdminUpdateHolding = (holdingId, amount) => request('/admin/update_holding.php', { method: 'POST', body: { holdingId, amount } }).then((d) => d.holding)
export const apiAdminDeleteHolding = (holdingId) => request('/admin/delete_holding.php', { method: 'POST', body: { holdingId } })
export const apiAdminUpdateModes = (userId, payload) => request('/admin/update_trade_mode.php', { method: 'POST', body: { userId, ...payload } }).then((d) => d.user)
export const apiAdminImpersonate = (userId) => request('/admin/impersonate.php', { method: 'POST', body: { userId } })
export const apiAdminGetChats   = () => request('/admin/support_chats.php').then((d) => d.conversations)
export const apiAdminGetChat    = (userId) => request('/admin/support_chat.php?userId=' + userId).then((d) => d.messages)
export const apiAdminSendChat   = (userId, message) => request('/admin/support_chat.php', { method: 'POST', body: { userId, message } }).then((d) => d.message)
export const apiAdminGetWithdrawRequests = () => request('/admin/withdraw_requests.php').then((d) => d.withdraws)
export const apiAdminUpdateWithdrawStatus = (withdrawId, status, txId = null, fee = null) =>
  request('/admin/update_withdraw_status.php', {
    method: 'POST',
    body: { withdrawId, status, txId, fee },
  }).then((d) => d.withdraw)
export const apiAdminGetDepositRequests = () => request('/admin/deposit_requests.php').then((d) => d.deposits)
export const apiAdminUpdateDepositStatus = (depositId, status, txId = null) =>
  request('/admin/update_deposit_status.php', {
    method: 'POST',
    body: { depositId, status, txId },
  }).then((d) => d.deposit)
export const apiAdminGetDepositAddresses = () => request('/admin/deposit_addresses.php').then((d) => d.addresses)
export const apiAdminAddDepositAddress = (currency, network, address) =>
  request('/admin/add_deposit_address.php', { method: 'POST', body: { currency, network, address } }).then((d) => d.address)
export const apiAdminUpdateDepositAddress = (id, address) =>
  request('/admin/update_deposit_address.php', { method: 'POST', body: { id, address } }).then((d) => d.address)
export const apiAdminDeleteDepositAddress = (id) => request('/admin/delete_deposit_address.php', { method: 'POST', body: { id } })
export async function apiAdminUploadDepositQr(id, file) {
  const ROOT = (import.meta.env.VITE_BACKEND_URL || '/api').replace(/\/api$/, '')
  const url = ROOT + '/api/admin/upload_deposit_qr.php'
  const fd = new FormData()
  fd.append('id', id)
  fd.append('qr', file)

  const headers = {}
  const t = localStorage.getItem('ct.token')
  if (t) headers['Authorization'] = 'Bearer ' + t

  const res = await fetch(url, { method: 'POST', headers, body: fd })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data.address
}
export const apiAdminUpdateVerified = (userId, verified) => request('/admin/update_verified.php', { method: 'POST', body: { userId, verified } })
export const apiAdminUpdateUserStatus = (userId, status) => request('/admin/update_user_status.php', { method: 'POST', body: { userId, status } })
export const apiAdminUpdateKycStatus = (userId, kycStatus) => request('/admin/update_kyc_status.php', { method: 'POST', body: { userId, kycStatus } })
export async function apiSubmitKyc({ idType, frontFile, backFile, selfieFile }) {
  const ROOT = (import.meta.env.VITE_BACKEND_URL || '/api').replace(/\/api$/, '')
  const url = ROOT + '/api/kyc_upload.php'
  const fd = new FormData()
  fd.append('idType', idType)
  if (frontFile) fd.append('front', frontFile)
  if (backFile) fd.append('back', backFile)
  if (selfieFile) fd.append('selfie', selfieFile)

  const headers = {}
  const t = localStorage.getItem('ct.token')
  if (t) headers['Authorization'] = 'Bearer ' + t

  const res = await fetch(url, { method: 'POST', headers, body: fd })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data
}

export const apiAdminGetUserKyc = (userId) => request('/admin/user_kyc.php?userId=' + userId).then((d) => d.kyc)
export const apiAdminGetUserSessions = (userId) => request('/admin/user_sessions.php?userId=' + userId).then((d) => d.sessions)
