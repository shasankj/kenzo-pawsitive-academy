import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mail, Lock, User, ArrowRight, Loader2, PartyPopper } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { Logo, Mascot, Paw } from '../components/Art'

const PERKS = [
  ['🪑', 'Pick your exact seat, cinema-style'],
  ['🎓', 'Trainers who really know their treats'],
  ['🗓️', 'Find classes by trainer, room & day'],
]

export default function AuthPage() {
  const { login } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STUDENT' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') {
        await login(form.email.trim(), form.password)
      } else {
        const r = await api.signup({ ...form, name: form.name.trim(), email: form.email.trim() })
        setSent(r)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (m) => { setMode(m); setError(''); setSent(null) }

  return (
    <div className="auth">
      <aside className="auth-hero">
        <div className="hero-paws" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => <Paw key={i} size={34 + (i % 3) * 14} className={`fp fp${i}`} />)}
        </div>
        <Logo />
        <div className="hero-center">
          <Mascot size={230} />
          <h1>Sit. Stay.<br /><span>Study.</span></h1>
          <p>The coaching academy built for dogs — book a class, grab your favourite seat, and learn from the very best trainers.</p>
        </div>
        <ul className="perks">
          {PERKS.map(([e, t]) => <li key={t}><span>{e}</span>{t}</li>)}
        </ul>
      </aside>

      <section className="auth-panel">
        <motion.div className="auth-card" layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          <div className="seg" role="tablist">
            {['login', 'signup'].map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => switchMode(m)}>
                {mode === m && <motion.span layoutId="seg-pill" className="seg-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span>{m === 'login' ? 'Log in' : 'Sign up'}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {sent ? (
              <motion.div key="sent" className="sent" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <PartyPopper size={44} />
                <h2>Application sent!</h2>
                <p>{sent.message || 'Thanks for signing up.'}</p>
                <p className="muted">A Head Dog will sniff over your application soon. Once approved, you can log in.</p>
                <button className="btn btn-primary" onClick={() => switchMode('login')}>Back to log in <ArrowRight size={18} /></button>
              </motion.div>
            ) : (
              <motion.form key={mode} onSubmit={submit} initial={{ opacity: 0, x: mode === 'login' ? -16 : 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <h2>{mode === 'login' ? 'Welcome back, good pup!' : 'Join the pack'}</h2>
                <p className="muted">{mode === 'login' ? 'Log in to see your classes and bookings.' : 'Tell us who you are. New accounts are approved by an admin.'}</p>

                {mode === 'signup' && (
                  <label className="field">
                    <span>Name</span>
                    <div className="input"><User size={18} /><input required maxLength={100} placeholder="Sir Barksalot" value={form.name} onChange={set('name')} autoComplete="name" /></div>
                  </label>
                )}
                <label className="field">
                  <span>Email</span>
                  <div className="input"><Mail size={18} /><input required type="email" maxLength={255} placeholder="you@woof.com" value={form.email} onChange={set('email')} autoComplete="email" /></div>
                </label>
                <label className="field">
                  <span>Password</span>
                  <div className="input"><Lock size={18} /><input required type="password" minLength={mode === 'signup' ? 8 : undefined} maxLength={128} placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'} value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div>
                </label>

                {mode === 'signup' && (
                  <div className="field">
                    <span>I am a…</span>
                    <div className="choice">
                      {[['STUDENT', '🐶', 'Pup', 'I want to learn'], ['TEACHER', '🎓', 'Trainer', 'I want to teach']].map(([v, e, t, s]) => (
                        <button type="button" key={v} className={form.role === v ? 'on' : ''} onClick={() => setForm((f) => ({ ...f, role: v }))}>
                          <em>{e}</em><strong>{t}</strong><small>{s}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <AnimatePresence>
                  {error && <motion.div className="form-error" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>{error}</motion.div>}
                </AnimatePresence>

                <button className="btn btn-primary btn-block" disabled={busy}>
                  {busy ? <Loader2 className="spin" size={18} /> : null}
                  {mode === 'login' ? 'Let’s go' : 'Request to join'} {!busy && <ArrowRight size={18} />}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </section>
    </div>
  )
}
