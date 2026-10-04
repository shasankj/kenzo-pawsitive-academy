import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Compass, Ticket, Palette, ShieldCheck, LogOut, KeyRound } from 'lucide-react'
import { useAuth } from '../auth'
import { useCatalog } from '../catalog'
import { Logo } from './Art'
import { ChangePasswordDialog } from './Dialogs'
import { ROLE_LABEL, initials, hueFor } from '../util'

const NAV = {
  STUDENT: [
    { to: '/', label: 'Discover', icon: Compass, end: true },
    { to: '/bookings', label: 'My bookings', icon: Ticket },
  ],
  TEACHER: [
    { to: '/', label: 'Discover', icon: Compass, end: true },
    { to: '/studio', label: 'Studio', icon: Palette },
  ],
  ADMIN: [
    { to: '/', label: 'Discover', icon: Compass, end: true },
    { to: '/admin', label: 'Head Dog HQ', icon: ShieldCheck },
  ],
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const { activeBookings } = useCatalog()
  const links = NAV[user.role] || NAV.STUDENT
  const [pwOpen, setPwOpen] = useState(false)

  return (
    <div className="shell">
      <div className="blobs" aria-hidden="true"><i /><i /><i /></div>
      <header className="topbar">
        <Link to="/" aria-label="Kenzo Pawsitive Academy home"><Logo /></Link>

        <nav className="nav">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link">
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
                  <Icon size={18} />
                  <span>{label}</span>
                  {to === '/bookings' && activeBookings.length > 0 && <b className="nav-count">{activeBookings.length}</b>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="me">
          <div className="avatar" style={{ '--h': hueFor(user.name) }}>{initials(user.name)}</div>
          <div className="me-text">
            <strong>{user.name}</strong>
            <span className={`role role-${user.role.toLowerCase()}`}>{ROLE_LABEL[user.role] || user.role}</span>
          </div>
          <button className="icon-btn" onClick={() => setPwOpen(true)} title="Change password" aria-label="Change password"><KeyRound size={18} /></button>
          <button className="icon-btn" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={18} /></button>
        </div>
      </header>

      {children}
      <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  )
}
