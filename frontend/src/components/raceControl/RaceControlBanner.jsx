import { motion, AnimatePresence } from 'framer-motion'

const CRITICAL = new Set(['red_flag','safety_car','virtual_safety_car'])

export default function RaceControlBanner({ event }) {
  if (!event || !CRITICAL.has(event.type)) return null
  const isRed = event.type === 'red_flag'
  const bg = isRed ? 'linear-gradient(90deg,#e10600,#991010)' : 'linear-gradient(90deg,#FFB800,#B77900)'
  const icon = event.icon || (isRed ? '🔴' : '🟡')
  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        style={{ background: bg, color: 'white', borderRadius:12, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, fontFamily:"'Space Grotesk',sans-serif", boxShadow:'0 4px 20px rgba(0,0,0,0.4)' }}
        role="alert"
        aria-live="assertive"
      >
        <span style={{ fontSize:20 }}>{icon}</span>
        <div>
          <div style={{ fontWeight:900, fontSize:14, letterSpacing:'0.06em' }}>{event.title}</div>
          <div style={{ fontSize:11, opacity:0.9 }}>{event.message} {event.sector ? `• Sector ${event.sector}` : ''} {event.lap ? `• Lap ${event.lap}` : ''}</div>
        </div>
        <span style={{ marginLeft:'auto', fontSize:11, opacity:0.8, fontVariantNumeric:'tabular-nums' }}>{event.time_label}</span>
      </motion.div>
    </AnimatePresence>
  )
}
