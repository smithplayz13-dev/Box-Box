import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react'

export default function ConnectionStatus({ status, stale, retryIn }) {
  // status: connected | connecting | disconnected | error
  const map = {
    connected: { color: '#00D2BE', bg: 'rgba(0,210,190,0.12)', icon: Wifi, label: 'LIVE' },
    connecting: { color: '#FFB800', bg: 'rgba(255,184,0,0.12)', icon: RefreshCw, label: 'CONNECTING' },
    disconnected: { color: '#888', bg: 'rgba(255,255,255,0.06)', icon: WifiOff, label: 'OFFLINE' },
    error: { color: '#E10600', bg: 'rgba(225,6,0,0.12)', icon: AlertTriangle, label: 'ERROR' },
    stale: { color: '#FFB800', bg: 'rgba(255,184,0,0.12)', icon: AlertTriangle, label: 'STALE' },
  }
  const key = stale ? 'stale' : status
  const cfg = map[key] || map.disconnected
  const Icon = cfg.icon
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, fontFamily:"'Space Grotesk', sans-serif" }}>
      <span style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:100, background: cfg.bg, border:`1px solid ${cfg.color}30`, color: cfg.color, fontSize:11, fontWeight:800, letterSpacing:'0.08em' }}>
        <Icon size={12} className={status==='connecting' ? 'animate-spin' : ''} />
        {cfg.label}
        {status==='connected' && <span style={{ width:7, height:7, borderRadius:'50%', background: cfg.color, boxShadow:`0 0 8px ${cfg.color}`, display:'inline-block', marginLeft:4 }} />}
      </span>
      {stale && <span style={{ fontSize:10, color:'#FFB800' }}>stale &gt;15s</span>}
      {retryIn != null && status!=='connected' && <span style={{ fontSize:10, color:'#999' }}>retry {retryIn}s</span>}
    </div>
  )
}
