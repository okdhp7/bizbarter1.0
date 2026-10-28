import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Pending from './pages/Pending'
import Dashboard from './pages/Dashboard'
import Offers from './pages/Offers'
import OfferDetail from './pages/OfferDetail'
import OfferNew from './pages/OfferNew'
import MyOffers from './pages/MyOffers'
import Negotiations from './pages/Negotiations'
import Deals from './pages/Deals'
import DealDetail from './pages/DealDetail'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import AdminLogin from './pages/AdminLogin'
import { About, Privacy, Terms } from './pages/InfoPages'

function Guard({ children, admin = false, pub = false }: { children: ReactNode; admin?: boolean; pub?: boolean }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="empty">불러오는 중…</div>
  // 공개 화면(오퍼 목록·상세): 비로그인 방문자도 열람, 로그인은 상단 메뉴에서
  if (pub) return <Layout>{children}</Layout>
  // 관리자 화면은 /admin 에서 별도 로그인
  if (admin && user?.role !== 'admin') return <AdminLogin />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />
  if (!admin && user.role === 'member' && user.status !== 'approved') return <Navigate to="/pending" replace />
  return <Layout>{children}</Layout>
}

function ToList() {
  const loc = useLocation()
  return <Navigate to={`/${loc.search}`} replace />
}

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/pending" element={<Pending />} />
      <Route path="/about" element={<About />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      {/* 랜딩 = 오퍼 리스트 (공개) */}
      <Route path="/" element={user?.role === 'admin' ? <Navigate to="/admin" replace /> : <Guard pub><Offers /></Guard>} />
      <Route path="/offers" element={<ToList />} />
      <Route path="/home" element={<Guard><Dashboard /></Guard>} />
      <Route path="/offers/new" element={<Guard><OfferNew /></Guard>} />
      <Route path="/offers/:id" element={<Guard pub><OfferDetail /></Guard>} />
      <Route path="/my/offers" element={<Guard><MyOffers /></Guard>} />
      <Route path="/negotiations" element={<Guard><Negotiations /></Guard>} />
      <Route path="/negotiations/:id" element={<Guard><Negotiations /></Guard>} />
      <Route path="/deals" element={<Guard><Deals /></Guard>} />
      <Route path="/deals/:id" element={<Guard><DealDetail /></Guard>} />
      <Route path="/profile" element={<Guard><Profile /></Guard>} />
      <Route path="/admin" element={<Guard admin><Admin /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
