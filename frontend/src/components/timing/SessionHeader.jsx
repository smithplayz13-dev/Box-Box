import { Clock, Flag, Activity, Timer } from 'lucide-react'
import ConnectionStatus from './ConnectionStatus'

export default function SessionHeader({ meta, connection, stale, retryIn }) {
  if (!meta) return null
  const { meeting_name, circuit, session_name, session_type, date_start, status, total_laps, timestamp, session_best } = meta
  const sessionLabel = session_name || session_type || 'Session'
  // local session time
  let localTime = ''
  try {
    if (date_start) {
      const d = new Date(date_start)
      localTime = d.toLocaleString(undefined, { weekday:'short', hour:'2-digit', minute:'2-digit', timeZoneName:'short' })
    }
  } catch {
    // invalid date_start — localTime remains empty
  }
  return (
    <div style={{ background:'linear-gradient(180deg, #0f0f0f, #080808)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, padding:'14px 16px', display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#e10600,#ff4422)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:900, fontSize:14 }}>LIVE</div>
          <div>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:900, fontSize:18, letterSpacing:'-0.02em', color:'white', textTransform:'uppercase' }}>BOXBOX LIVE</div>
            <div style={{ fontSize:11, color:'#999', letterSpacing:'0.06em' }}>{meeting_name} • {circuit || ''}</div>
          </div>
        </div>
        <ConnectionStatus status={connection} stale={stale} retryIn={retryIn} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:8, fontFamily:"'Space Grotesk',sans-serif" }}>
        <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'8px 10px' }}>
          <div style={{ fontSize:10, color:'#888', letterSpacing:'0.08em' }}>SESSION</div>
          <div style={{ fontSize:13, color:'white', fontWeight:800, display:'flex', alignItems:'center', gap:6 }}><Flag size={12} color="#e10600" /> {sessionLabel}</div>
          <div style={{ fontSize:11, color: status==='Live' ? '#00D2BE' : status==='Upcoming' ? '#FFB800' : '#999' }}>{status} {status==='Live' && '●'}</div>
        </div>
        <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'8px 10px' }}>
          <div style={{ fontSize:10, color:'#888', letterSpacing:'0.08em' }}>LOCAL TIME</div>
          <div style={{ fontSize:12, color:'white', display:'flex', alignItems:'center', gap:6 }}><Clock size={12} /> {localTime || '—'}</div>
          <div style={{ fontSize:10, color:'#666' }}>{timestamp ? new Date(timestamp).toLocaleTimeString() : ''}</div>
        </div>
        <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'8px 10px' }}>
          <div style={{ fontSize:10, color:'#888', letterSpacing:'0.08em' }}>SESSION BEST</div>
          <div style={{ fontSize:13, color:'#C800FF', fontWeight:800, fontVariantNumeric:'tabular-nums', display:'flex', alignItems:'center', gap:6 }}><Timer size={12} color="#C800FF" /> {session_best || '—'}</div>
          <div style={{ fontSize:10, color:'#666' }}>purple = session best</div>
        </div>
        {total_laps && <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'8px 10px' }}>
          <div style={{ fontSize:10, color:'#888', letterSpacing:'0.08em' }}>LAPS</div>
          <div style={{ fontSize:13, color:'white', fontWeight:800 }}><Activity size={12} style={{ display:'inline', marginRight:4 }} /> {total_laps}</div>
        </div>}
      </div>
    </div>
  )
}
