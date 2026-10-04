import { motion } from 'framer-motion'

export default function Page({ children, className = '' }) {
  return (
    <motion.main
      className={`page ${className}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      {children}
    </motion.main>
  )
}
