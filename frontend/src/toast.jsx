import { createContext, useCallback, useContext, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'

const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info }

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const toast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setItems((l) => [...l, { id, message, type }])
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4200)
  }, [])
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => {
            const Icon = ICONS[t.type]
            return (
              <motion.div
                key={t.id}
                className={`toast ${t.type}`}
                layout
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
              >
                <Icon size={20} /> <span>{t.message}</span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
