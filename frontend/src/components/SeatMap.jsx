import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Check, Heart, X } from 'lucide-react'
import { Paw } from './Art'
import { rowLetter, seatLabel } from '../util'

// Auto-insert a centre aisle in wide rooms so big halls feel like real halls.
const aisleAfter = (cols) => (cols >= 8 ? Math.floor(cols / 2) : 0)

export default function SeatMap({ rows, cols, seats, selected, mine, onToggle, disabled }) {
  const byPos = useMemo(() => new Map(seats.map((s) => [`${s.row}:${s.col}`, s])), [seats])
  const aisle = aisleAfter(cols)

  const template = []
  for (let c = 1; c <= cols; c++) {
    template.push('var(--seat)')
    if (c === aisle) template.push('calc(var(--seat) * 0.6)')
  }

  const cells = []
  for (let r = 1; r <= rows; r++) {
    cells.push(<div key={`l${r}`} className="rowlabel">{rowLetter(r)}</div>)
    for (let c = 1; c <= cols; c++) {
      const seat = byPos.get(`${r}:${c}`)
      if (!seat) {
        cells.push(<span key={`${r}:${c}`} />)
      } else {
        const isMine = mine.has(seat.seat_id)
        const isSel = selected.has(seat.seat_id)
        const state = isMine ? 'mine' : !seat.available ? 'taken' : isSel ? 'picked' : 'free'
        const label = seatLabel(r, c)
        cells.push(
          <button
            key={`${r}:${c}`}
            type="button"
            className={`seat ${state}`}
            style={{ '--d': `${(r + c) * 28}ms` }}
            disabled={state === 'taken' || state === 'mine' || disabled}
            onClick={() => onToggle(seat)}
            aria-pressed={isSel}
            aria-label={`Seat ${label}, ${state === 'mine' ? 'booked by you' : state === 'taken' ? 'taken' : isSel ? 'selected' : 'available'}`}
            title={`${label} · ${state === 'mine' ? 'Yours' : state === 'taken' ? 'Taken' : isSel ? 'Selected' : 'Free'}`}
          >
            <Paw size={100} className="seat-paw" style={{ width: '100%', height: '100%' }} />
            <span className="seat-badge">
              {state === 'picked' && <Check size={14} strokeWidth={3.500} />}
              {state === 'mine' && <Heart size={12} fill="currentColor" />}
              {state === 'taken' && <X size={13} strokeWidth={3} />}
            </span>
            <span className="seat-tip">{label}</span>
          </button>,
        )
      }
      if (c === aisle) cells.push(<span key={`a${r}`} />)
    }
  }

  return (
    <div className="theatre">
      <div className="stage" aria-hidden="true">
        <div className="stage-glow" />
        <span>🎓 Trainer’s podium</span>
      </div>
      <div className="seat-scroll">
        <motion.div
          className="seat-grid"
          style={{ '--cols': cols, gridTemplateColumns: `1.6rem ${template.join(' ')}` }}
          initial={{ opacity: 0, rotateX: 28, y: 20 }}
          animate={{ opacity: 1, rotateX: 0, y: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        >
          {cells}
        </motion.div>
      </div>
      <ul className="legend">
        <li><i className="seat-key free"><Paw size={22} /></i> Available</li>
        <li><i className="seat-key picked"><Paw size={22} /></i> Your pick</li>
        <li><i className="seat-key taken"><Paw size={22} /></i> Taken</li>
        <li><i className="seat-key mine"><Paw size={22} /></i> Already yours</li>
      </ul>
    </div>
  )
}
