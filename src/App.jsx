import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, AdminRoute } from './components/Guards'
import Layout from './components/Layout'

import Login from './pages/Login'
import Register from './pages/Register'
import AdminLogin from './pages/AdminLogin'
import Dashboard from './pages/Dashboard'
import Markets from './pages/Markets'
import CoinDetail from './pages/CoinDetail'
import Portfolio from './pages/Portfolio'
import Trade from './pages/Trade'
import Wallet from './pages/Wallet'
import Convert from './pages/Convert'
import AdminHome from './pages/admin/AdminHome'
import Users from './pages/admin/Users'
import Withdrawals from './pages/admin/Withdrawals'
import DepositRequests from './pages/admin/DepositRequests'
import ManageWallets from './pages/admin/ManageWallets'
import Analytics from './pages/admin/Analytics'
import Chat from './pages/admin/Chat'
import UpdatePassword from './pages/account/UpdatePassword'
import UpdateAccount from './pages/account/UpdateAccount'
import TradeHistory from './pages/account/TradeHistory'
import Notifications from './pages/account/Notifications'
import Kyc from './pages/account/Kyc'
import DepositHistory from './pages/account/DepositHistory'
import DepositRequest from './pages/account/DepositRequest'
import WithdrawHistory from './pages/account/WithdrawHistory'
import WithdrawRequest from './pages/account/WithdrawRequest'
import ComingSoon from './pages/account/ComingSoon'
import Support from './pages/account/Support'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<AdminLogin />} />

          {/* Authenticated (inside the app shell) */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/convert" element={<Convert />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/coin/:id" element={<CoinDetail />} />
            <Route path="/trade" element={<Trade />} />

            {/* Account */}
            <Route path="/account/password" element={<UpdatePassword />} />
            <Route path="/account/profile" element={<UpdateAccount />} />
            <Route path="/account/history" element={<TradeHistory />} />
            <Route path="/account/notifications" element={<Notifications />} />
            <Route path="/account/kyc" element={<Kyc />} />
            <Route path="/account/deposits" element={<DepositHistory />} />
            <Route path="/account/deposit" element={<DepositRequest />} />
            <Route path="/account/withdrawals" element={<WithdrawHistory />} />
            <Route path="/account/withdraw" element={<WithdrawRequest />} />
            <Route path="/support" element={<Support />} />

            {/* Admin-only */}
            <Route
              path="/admin/overview"
              element={
                <AdminRoute>
                  <AdminHome />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <Users />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/withdrawals"
              element={
                <AdminRoute>
                  <Withdrawals />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/deposits"
              element={
                <AdminRoute>
                  <DepositRequests />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/wallets"
              element={
                <AdminRoute>
                  <ManageWallets />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <AdminRoute>
                  <Analytics />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/chat"
              element={
                <AdminRoute>
                  <Chat />
                </AdminRoute>
              }
            />
          </Route>

          {/* Fallbacks */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
