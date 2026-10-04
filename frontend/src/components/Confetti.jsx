import { useEffect, useMemo, useState } from 'react'

const BITS = ['🐾', '🦴', '⭐', '🎉', '🐶', '💛']

export default function Confetti({ onDone }) {
  const [alive, setAlive] = useState(true)
  const bits = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        ch: BITS[i % BITS.length],
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        dur: 1.8 + Math.random() * 1.4,
        drift: (Math.random() - 0.5) * 220,
        spin: (Math.random() - 0.5) * 720,
        size: 18 + Math.random() * 18,
      })),
    [],
  )
  useEffect(() => {
    const t = setTimeout(() => { setAlive(false); onDone?.() }, 3400)
    return () => clearTimeout(t)
  }, [onDone])
  if (!alive) return null
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b) => (
        <span
          key={b.id}
          style={{
            left: `${b.left}%`, fontSize: b.size, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`,
            '--drift': `${b.drift}px`, '--spin': `${b.spin}deg`,
          }}
        >{b.ch}</span>
      ))}
    </div>
  )
}
