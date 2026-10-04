export function Paw({ size = 24, className = '', ...rest }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true" {...rest}>
      <g fill="currentColor">
        <path d="M24 22c-6.5 0-13 6.6-13 12.4 0 4 3 6.1 6.4 6.1 2.3 0 3.7-.9 6.6-.9s4.3.9 6.6.9c3.4 0 6.4-2.1 6.4-6.1C37 28.6 30.500 22 24 22z" />
        <ellipse cx="9.500" cy="22" rx="4.600" ry="6.200" transform="rotate(-18 9.500 22)" />
        <ellipse cx="18" cy="11.500" rx="4.800" ry="6.800" transform="rotate(-6 18 11.500)" />
        <ellipse cx="30" cy="11.500" rx="4.800" ry="6.800" transform="rotate(6 30 11.500)" />
        <ellipse cx="38.500" cy="22" rx="4.600" ry="6.200" transform="rotate(18 38.500 22)" />
      </g>
    </svg>
  )
}

export function Mascot({ size = 200, className = '' }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={`mascot ${className}`} role="img" aria-label="A Shiba Inu wearing a graduation cap">
      <ellipse cx="100" cy="190" rx="56" ry="7" fill="#1f1b3a" opacity=".12" />
      {/* upright triangular ears */}
      <g className="mascot-ears">
        <path d="M38 96C32 66 34 44 40 30c2-5 8-5 12-2l38 28z" fill="#e8913a" />
        <path d="M162 96c6-30 4-52-2-66-2-5-8-5-12-2l-38 28z" fill="#e8913a" />
        <path d="M46 84c-3-18-3-30 0-40l26 20z" fill="#ffd9d0" />
        <path d="M154 84c3-18 3-30 0-40l-26 20z" fill="#ffd9d0" />
      </g>
      {/* head with cheek fluff */}
      <path d="M28 120C26 80 60 54 100 54s74 26 72 66c1 10-5 18-12 21l8 11c-12 5-22 10-30 18-12 9-26 12-38 12s-26-3-38-12c-8-8-18-13-30-18l8-11c-7-3-13-11-12-21z" fill="#e8913a" />
      {/* cream urajiro: cheeks, muzzle, chin */}
      <path d="M100 112c-14 0-26 8-34 18-8 4-18 8-26 4 6 12 14 20 24 28 10 9 24 12 36 12s26-3 36-12c10-8 18-16 24-28-8 4-18 0-26-4-8-10-20-18-34-18z" fill="#fff3df" />
      {/* shiba eyebrow dots */}
      <ellipse cx="74" cy="92" rx="7" ry="4.500" fill="#fff3df" transform="rotate(-10 74 92)" />
      <ellipse cx="126" cy="92" rx="7" ry="4.500" fill="#fff3df" transform="rotate(10 126 92)" />
      <g className="mascot-eyes">
        <ellipse cx="76" cy="108" rx="5.500" ry="7" fill="#2a1d2e" />
        <ellipse cx="124" cy="108" rx="5.500" ry="7" fill="#2a1d2e" />
        <circle cx="77.800" cy="105" r="2" fill="#fff" />
        <circle cx="125.800" cy="105" r="2" fill="#fff" />
      </g>
      <ellipse cx="100" cy="127" rx="9.500" ry="6.500" fill="#2a1d2e" />
      <ellipse cx="97.500" cy="125" rx="3" ry="1.500" fill="#fff" opacity=".6" />
      <path d="M100 133v8M100 141c-7 8-18 7-22 1M100 141c7 8 18 7 22 1" stroke="#2a1d2e" strokeWidth="3.200" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path className="mascot-tongue" d="M93 145c0 12 14 12 14 0z" fill="#ff7d8e" />
      {/* graduation cap, perched between the ears */}
      <path d="M80 62v12c12 8 28 8 40 0V62z" fill="#2b2a55" />
      <path d="M58 56l42-19 42 19-42 19z" fill="#383772" />
      <path d="M58 56l42 19v5L58 61z" fill="#2b2a55" />
      <path d="M138 58v22" stroke="#ffc83d" strokeWidth="3" strokeLinecap="round" />
      <circle cx="138" cy="84" r="4.500" fill="#ffc83d" />
      <circle cx="100" cy="56" r="3.200" fill="#ffc83d" />
    </svg>
  )
}

export function Logo({ size = 34 }) {
  return (
    <span className="logo">
      <span className="logo-mark"><Paw size={size * 0.62} /></span>
      <span className="logo-text">Kenzo Positive<em>Academy</em></span>
    </span>
  )
}

export function Spinner({ label = 'Fetching…' }) {
  return (
    <div className="spinner" role="status">
      <Paw size={28} /><Paw size={28} /><Paw size={28} />
      <span className="sr">{label}</span>
    </div>
  )
}

export function Empty({ emoji = '🐕‍🦺', title, children }) {
  return (
    <div className="empty">
      <div className="empty-emoji">{emoji}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}
