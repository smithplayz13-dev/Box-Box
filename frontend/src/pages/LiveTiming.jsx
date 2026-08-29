import { useEffect, useState, useCallback, useRef, memo } from 'react'
import { getLiveSessions, getLiveDiscover, getLiveTiming } from '../services/api'
import SessionHeader from '../components/timing/SessionHeader'
import TimingTower from '../components/timing/TimingTower'
import { RefreshCw, Calendar, Clock, AlertTriangle, WifiOff } from 'lucide-react'

function Countdown({ dateStr }) {
  const [left, setLeft] = useState('')
  useEffect(()=>{
    if (!dateStr) return
    const id = setInterval(()=>{
      const now = new Date()
      const target = new Date(dateStr)
      const diff = target - now
      if (diff <= 0) { setLeft('Starting now'); clearInterval(id); return }
      const d = Math.floor(diff/86400000)
      const h = Math.floor(diff%86400000/3600000)
      const m = Math.floor(diff%3600000/60000)
      const s = Math.floor(diff%60000/1000)
      setLeft(`${d}d ${h}h ${m}m ${s}s`)
    },1000)
    return ()=>clearInterval(id)
  },[dateStr])
  return <span style={{ fontVariantNumeric:'tabular-nums', fontWeight:800 }}>{left}</span>
}

export default function LiveTiming(){
  const [year, setYear] = useState(2025)
  const [sessions, setSessions] = useState([])
  const [selectedKey, setSelectedKey] = useState(null)
  const [meta, setMeta] = useState(null)
  const [rows, setRows] = useState([])
  const [sessionBest, setSessionBest] = useState(null)
  const [status, setStatus] = useState('connecting') // connected, connecting, disconnected, error
  const [stale, setStale] = useState(false)
  const [retryIn, setRetryIn] = useState(null)
  const [error, setError] = useState(null)
  const [discover, setDiscover] = useState(null)
  const [loading, setLoading] = useState(true)
  const lastUpdateRef = useRef(0)
  const backoffRef = useRef(1)
  const timerRef = useRef(null)

  // Discover sessions on mount and when year changes
  const fetchDiscover = useCallback(async ()=>{
    try {
      const r = await getLiveDiscover(year)
      setDiscover(r.data)
      // auto-select live or next or first completed
      const live = r.data.live
      const next = r.data.next
      const all = r.data.all || []
      if (live) {
        setSelectedKey(live.session_key)
      } else if (all.length>0) {
        // pick most recent completed
        const completed = [...all].reverse().find(s=>{
          try { return new Date(s.date_end) < new Date() } catch { return false }
        })
        if (completed) setSelectedKey(completed.session_key)
        else if (next) setSelectedKey(next.session_key)
        else if (all[0]) setSelectedKey(all[0].session_key)
      }
      // also fetch sessions list for dropdown
      const s = await getLiveSessions(year)
      setSessions(s.data.sessions || [])
    } catch(e){
      setError(e.message)
      setStatus('error')
    } finally { setLoading(false) }
  },[year])

  useEffect(()=>{ fetchDiscover() },[fetchDiscover])

  const fetchTiming = useCallback(async ()=>{
    if (!selectedKey) return
    try {
      const r = await getLiveTiming(selectedKey)
      const data = r.data
      setMeta(data)
      setRows(data.drivers || [])
      setSessionBest(data.session_best)
      setError(null)
      setStatus('connected')
      setStale(false)
      backoffRef.current = 1
      lastUpdateRef.current = Date.now()
      setRetryIn(null)
    } catch(e){
      const msg = e.message || 'API unavailable'
      setError(msg)
      setStatus('error')
      // exponential backoff
      backoffRef.current = Math.min(backoffRef.current*2, 32)
      setRetryIn(backoffRef.current)
    }
  },[selectedKey])

  // polling with adaptive interval + stale detection
  useEffect(()=>{
    if (!selectedKey) return
    fetchTiming()
    const isLive = meta?.status === 'Live'
    let intervalMs = isLive ? 3000 : 15000
    // if error, use backoff
    if (status==='error') intervalMs = backoffRef.current * 1000

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(()=>{
      // stale check
      if (Date.now() - lastUpdateRef.current > 15000) setStale(true)
      fetchTiming()
    }, intervalMs)

    // also countdown for retryIn
    const retryTimer = setInterval(()=>{
      if (retryIn != null && retryIn>0) setRetryIn(r=> r-1)
    },1000)

    return ()=>{ clearInterval(timerRef.current); clearInterval(retryTimer) }
  },[selectedKey, meta?.status, fetchTiming, status, retryIn])

  // Manual session selection via dropdowns
  const handleSelect = (e)=>{
    const v = Number(e.target.value)
    if (v) setSelectedKey(v)
  }

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#999' }}><RefreshCw className="animate-spin" style={{ display:'inline' }} /> Loading sessions…</div>

  const live = discover?.live
  const next = discover?.next

  return (
    <div style={{ maxWidth:1200, margin:'0 auto', padding:'16px', display:'flex', flexDirection:'column', gap:16, color:'white' }}>
      <SessionHeader meta={meta} connection={status} stale={stale} retryIn={retryIn} />

      {/* Controls */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', background:'rgba(255,255,255,0.04)', padding:10, borderRadius:12, border:'1px solid rgba(255,255,255,0.06)' }}>
        <select value={year} onChange={e=>setYear(Number(e.target.value))} style={{ background:'#1a1a1a', color:'white', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'6px 10px', fontSize:12 }}>
          <option value={2025}>2025</option>
          <option value={2026}>2026</option>
          <option value={2024}>2024</option>
        </select>
        <select value={selectedKey||''} onChange={handleSelect} style={{ background:'#1a1a1a', color:'white', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'6px 10px', fontSize:12, minWidth:200, flex:1 }}>
          <option value="">Select session…</option>
          {sessions.slice().reverse().map(s=>(
            <option key={s.session_key} value={s.session_key}>{s.meeting_name} — {s.session_name} ({new Date(s.date_start).toLocaleDateString()})</option>
          ))}
        </select>
        <button onClick={fetchTiming} style={{ padding:'6px 12px', borderRadius:8, background:'#e10600', color:'white', fontSize:12, fontWeight:800, display:'flex', alignItems:'center', gap:6 }}>
          <RefreshCw size={14} /> Refresh
        </button>
        {discover?.live && <span style={{ fontSize:11, color:'#00D2BE', display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:8, borderRadius:'50%', background:'#00D2BE', display:'inline-block' }} /> Live: {discover.live.meeting_name} {discover.live.session_name}</span>}
      </div>

      {/* No live -> next session card */}
      {!live && next && !meta && (
        <div style={{ background:'linear-gradient(135deg,#111,#1a1a1a)', border:'1px solid rgba(225,6,0,0.2)', borderRadius:16, padding:20, textAlign:'center' }}>
          <div style={{ fontSize:12, letterSpacing:'0.12em', color:'#e10600', fontWeight:800 }}>NEXT SESSION</div>
          <div style={{ fontSize:20, fontWeight:900, margin:'6px 0' }}>{next.meeting_name} — {next.session_name}</div>
          <div style={{ fontSize:13, color:'#999', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><Calendar size={14} /> {new Date(next.date_start).toLocaleString()} <Clock size={14} style={{ marginLeft:8 }} /> <Countdown dateStr={next.date_start} /></div>
        </div>
      )}

      {error && (
        <div style={{ background:'rgba(225,6,0,0.08)', border:'1px solid rgba(225,6,0,0.2)', borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:8, color:'#ff6b6b', fontSize:12 }}>
          <AlertTriangle size={16} /> {error} {error.includes('OpenF1') && '— OpenF1 may be down, try historical session.'}
        </div>
      )}

      {!rows || rows.length===0 ? (
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px dashed rgba(255,255,255,0.1)', borderRadius:12, padding:40, textAlign:'center', color:'#666' }}>
          <WifiOff size={24} style={{ margin:'0 auto 8px', opacity:0.5 }} />
          <div>No timing data for this session.</div>
          <div style={{ fontSize:11, marginTop:4 }}>Select a completed session from the dropdown to inspect historical data.</div>
        </div>
      ) : (
        <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', borderRadius:12, border:'1px solid rgba(255,255,255,0.06)', background:'#0a0a0a', padding:8 }}>
          <div style={{ minWidth:720 }}>
            <TimingTower rows={rows} sessionType={meta?.session_type} />
          </div>
        </div>
      )}

      <div style={{ fontSize:10, color:'#555', textAlign:'center' }}>Data: OpenF1 • Updates every 3s (live) • No mock data • Stale detection 15s • Exponential backoff on errors</div>
    </div>
  )
}
