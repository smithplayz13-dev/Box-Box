import { useEffect, useState, useCallback } from 'react'
import { getLiveSessions, getLiveDiscover, getLiveRaceControl } from '../services/api'
import RaceControlFeed from '../components/raceControl/RaceControlFeed'
import RaceControlBanner from '../components/raceControl/RaceControlBanner'
import { RefreshCw, AlertTriangle } from 'lucide-react'

export default function RaceControl(){
  const [year, setYear] = useState(2025)
  const [sessions, setSessions] = useState([])
  const [selectedKey, setSelectedKey] = useState(null)
  const [events, setEvents] = useState(null)
  const [selectedDriver] = useState(null)
  const [status, setStatus] = useState('connecting')
  const [error, setError] = useState(null)
  const [discover, setDiscover] = useState(null)
  const critical = events?.find(e=> ['red_flag','safety_car','virtual_safety_car'].includes(e.type))

  const fetchDiscover = useCallback(async ()=>{
    try {
      const r = await getLiveDiscover(year)
      setDiscover(r.data)
      const live = r.data.live
      const all = r.data.all || []
      if (live) setSelectedKey(live.session_key)
      else if (all.length>0){
        const completed = [...all].reverse().find(s=> new Date(s.date_end) < new Date())
        if (completed) setSelectedKey(completed.session_key)
        else if (r.data.next) setSelectedKey(r.data.next.session_key)
      }
      const s = await getLiveSessions(year)
      setSessions(s.data.sessions || [])
    } catch(e){ setError(e.message) }
  },[year])

  const fetchRC = useCallback(async ()=>{
    if (!selectedKey) return
    try {
      const r = await getLiveRaceControl(selectedKey)
      // dedup: keep map by id
      const incoming = r.data.events || []
      // avoid duplicate notifications: only update if new ids
      setEvents(prev=>{
        if (!prev) return incoming
        const prevIds = new Set(prev.map(e=>e.id))
        const newOnes = incoming.filter(e=> !prevIds.has(e.id))
        if (newOnes.length===0 && incoming.length===prev.length) return prev
        // merge: newest first already, dedup by id
        const map = new Map()
        ;[...incoming, ...prev].forEach(e=>{ if(!map.has(e.id)) map.set(e.id, e)})
        return Array.from(map.values()).sort((a,b)=> new Date(b.timestamp) - new Date(a.timestamp)).slice(0,200)
      })
      setStatus('connected')
      setError(null)
    } catch(e){
      setError(e.message)
      setStatus('error')
    }
  },[selectedKey])

  useEffect(()=>{ fetchDiscover() },[fetchDiscover])
  useEffect(()=>{
    if (!selectedKey) return
    fetchRC()
    const isLive = discover?.live?.session_key === selectedKey
    const iv = setInterval(fetchRC, isLive ? 5000 : 30000)
    return ()=> clearInterval(iv)
  },[selectedKey, discover, fetchRC])

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding:'16px', display:'flex', flexDirection:'column', gap:14, color:'white' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#e10600,#ff4422)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900 }}>RC</div>
        <div>
          <div style={{ fontWeight:900, fontSize:18, letterSpacing:'-0.02em' }}>RACE CONTROL</div>
          <div style={{ fontSize:11, color:'#999' }}>FIA session feed • OpenF1</div>
        </div>
        <span style={{ marginLeft:'auto', fontSize:11, color: status==='connected'?'#00D2BE':'#FFB800', display:'flex', alignItems:'center', gap:4 }}><span style={{ width:7, height:7, borderRadius:'50%', background: status==='connected'?'#00D2BE':'#FFB800', display:'inline-block' }} /> {status.toUpperCase()}</span>
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', background:'rgba(255,255,255,0.04)', padding:10, borderRadius:12, border:'1px solid rgba(255,255,255,0.06)' }}>
        <select value={year} onChange={e=>setYear(Number(e.target.value))} style={{ background:'#1a1a1a', color:'white', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'6px 10px', fontSize:12 }}>
          <option value={2025}>2025</option>
          <option value={2026}>2026</option>
          <option value={2024}>2024</option>
        </select>
        <select value={selectedKey||''} onChange={e=>setSelectedKey(Number(e.target.value)||null)} style={{ background:'#1a1a1a', color:'white', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'6px 10px', fontSize:12, flex:1, minWidth:200 }}>
          <option value="">Select session…</option>
          {sessions.slice().reverse().map(s=> <option key={s.session_key} value={s.session_key}>{s.meeting_name || s.location} — {s.session_name} ({new Date(s.date_start).toLocaleDateString()})</option>)}
        </select>
        <button onClick={fetchRC} style={{ padding:'6px 12px', borderRadius:8, background:'#e10600', color:'white', fontSize:12, fontWeight:800, display:'flex', alignItems:'center', gap:6 }}><RefreshCw size={14}/> Refresh</button>
      </div>

      {critical && <RaceControlBanner event={critical} />}

      {error && <div style={{ background:'rgba(225,6,0,0.08)', border:'1px solid rgba(225,6,0,0.2)', borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:8, color:'#ff6b6b', fontSize:12 }}><AlertTriangle size={16}/> {error}</div>}

      <RaceControlFeed events={events} selectedDriver={selectedDriver} />
      <div style={{ fontSize:10, color:'#555', textAlign:'center' }}>History kept per session • Filters: All/Flags/Pit/Drivers/Strategy/Session • Driver filter isolates • No mock data</div>
    </div>
  )
}
