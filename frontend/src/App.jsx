import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAuth } from './auth'
import { CatalogProvider } from './catalog'
import Layout from './components/Layout'
import AuthPage from './pages/AuthPage'
import Discover from './pages/Discover'
import CourseDetail from './pages/CourseDetail'
import MyBookings from './pages/MyBookings'
import Studio from './pages/Studio'
import Admin from './pages/Admin'

function Guard({ roles, children }) {
  const { user } = useAuth()
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    )
  }

  return (
    <CatalogProvider>
      <Layout>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname.split('/')[1] || 'home'}>
            <Route path="/" element={<Discover />} />
            <Route path="/courses/:id" element={<CourseDetail />} />
            <Route path="/bookings" element={<Guard roles={['STUDENT']}><MyBookings /></Guard>} />
            <Route path="/studio" element={<Guard roles={['TEACHER']}><Studio /></Guard>} />
            <Route path="/admin" element={<Guard roles={['ADMIN']}><Admin /></Guard>} />
            <Route path="/auth" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </Layout>
    </CatalogProvider>
  )
}
