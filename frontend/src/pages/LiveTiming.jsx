import { useEffect, useState, useCallback, useRef } from 'react'
import { getLiveSessions, getLiveDiscover, getLiveTiming, getLiveMap, getLiveRaceControl } from '../services/api'
import SessionHeader from '../components/timing/SessionHeader'
import TimingTower from '../components/timing/TimingTower'
import CircuitMap from '../components/timing/CircuitMap'
import SelectedTelemetry from '../components/timing/SelectedTelemetry'
import RaceControlBanner from '../components/raceControl/RaceControlBanner'
import RaceControlFeed from '../components/raceControl/RaceControlFeed'
import { RefreshCw, Calendar, Clock, AlertTriangle, WifiOff, ChevronUp, ChevronDown, Flag } from 'lucide-react'

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
  const [cars, setCars] = useState([])
  const [raceEvents, setRaceEvents] = useState(null)
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState('connecting')
  const [stale, setStale] = useState(false)
  const [retryIn, setRetryIn] = useState(null)
  const [error, setError] = useState(null)
  const [discover, setDiscover] = useState(null)
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [rcOpen, setRcOpen] = useState(false)
  const lastUpdateRef = useRef(0)
  const backoffRef = useRef(1)
  const timerRef = useRef(null)
  const mapTimerRef = useRef(null)
  const rcTimerRef = useRef(null)

  const fetchDiscover = useCallback(async ()=>{
    try {
      const r = await getLiveDiscover(year)
      setDiscover(r.data)
      const live = r.data.live
      const all = r.data.all || []
      if (live) setSelectedKey(live.session_key)
      else if (all.length>0) {
        const completed = [...all].reverse().find(s=>{ try { return new Date(s.date_end) < new Date() } catch { return false } })
        if (completed) setSelectedKey(completed.session_key)
        else if (r.data.next) setSelectedKey(r.data.next.session_key)
        else if (all[0]) setSelectedKey(all[0].session_key)
      }
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
      setError(null)
      setStatus('connected')
      setStale(false)
      backoffRef.current = 1
      lastUpdateRef.current = Date.now()
      setRetryIn(null)
      // auto-select first driver if none selected
      if (!selected && data.drivers && data.drivers[0]) setSelected(data.drivers[0].abbr)
    } catch(e){
      const msg = e.message || 'API unavailable'
      setError(msg)
      setStatus('error')
      backoffRef.current = Math.min(backoffRef.current*2, 32)
      setRetryIn(backoffRef.current)
    }
  },[selectedKey, selected])

  const fetchMap = useCallback(async ()=>{
    if (!selectedKey) return
    try {
      const r = await getLiveMap(selectedKey)
      setCars(r.data.cars || [])
    } catch{
      // map errors are non-critical, keep stale cars
    }
  },[selectedKey])

  const fetchRC = useCallback(async ()=>{
    if (!selectedKey) return
    try {
      const r = await getLiveRaceControl(selectedKey)
      const incoming = r.data.events || []
      setRaceEvents(prev=>{
        if (!prev) return incoming
        const prevIds = new Set(prev.map(e=>e.id))
        const newOnes = incoming.filter(e=> !prevIds.has(e.id))
        if (newOnes.length===0 && incoming.length===prev.length) return prev
        const map = new Map()
        ;[...incoming, ...prev].forEach(e=>{ if(!map.has(e.id)) map.set(e.id, e)})
        return Array.from(map.values()).sort((a,b)=> new Date(b.timestamp) - new Date(a.timestamp)).slice(0,200)
      })
    } catch{
      // non-critical
    }
  },[selectedKey])

  useEffect(()=>{
    if (!selectedKey) return
    fetchTiming(); fetchMap(); fetchRC()
    const isLive = meta?.status === 'Live'
    let intervalMs = isLive ? 3000 : 15000
    if (status==='error') intervalMs = backoffRef.current * 1000
    if (timerRef.current) clearInterval(timerRef.current)
    if (mapTimerRef.current) clearInterval(mapTimerRef.current)
    if (rcTimerRef.current) clearInterval(rcTimerRef.current)
    timerRef.current = setInterval(()=>{
      if (Date.now() - lastUpdateRef.current > 15000) setStale(true)
      fetchTiming()
    }, intervalMs)
    mapTimerRef.current = setInterval(fetchMap, isLive ? 2000 : 8000)
    rcTimerRef.current = setInterval(fetchRC, isLive ? 5000 : 30000)
    const retryTimer = setInterval(()=>{ if (retryIn!=null && retryIn>0) setRetryIn(v=>v-1)},1000)
    return ()=>{ clearInterval(timerRef.current); clearInterval(mapTimerRef.current); clearInterval(rcTimerRef.current); clearInterval(retryTimer) }
  },[selectedKey, meta?.status, fetchTiming, fetchMap, fetchRC, status, retryIn])

  const handleSelect = (e)=>{
    const v = Number(e.target.value)
    if (v) { setSelectedKey(v); setSelected(null) }
  }

  // derived selected car/row
  const selectedRow = rows.find(r=>r.abbr===selected)
  const selectedCar = cars.find(c=>c.abbr===selected)

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#999' }}><RefreshCw className="animate-spin" style={{ display:'inline' }} /> Loading sessions…</div>

  const live = discover?.live
  const next = discover?.next

  const criticalEvent = raceEvents?.find(e=> ['red_flag','safety_car','virtual_safety_car'].includes(e.type))

  return (
    <div style={{ maxWidth:1400, margin:'0 auto', padding:'12px', display:'flex', flexDirection:'column', gap:12, color:'white' }}>
      <SessionHeader meta={meta} connection={status} stale={stale} retryIn={retryIn} />
      {criticalEvent && <RaceControlBanner event={criticalEvent} />}

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
            <option key={s.session_key} value={s.session_key}>{s.meeting_name || s.location} — {s.session_name} ({new Date(s.date_start).toLocaleDateString()})</option>
          ))}
        </select>
        <button onClick={()=>{fetchTiming(); fetchMap()}} style={{ padding:'6px 12px', borderRadius:8, background:'#e10600', color:'white', fontSize:12, fontWeight:800, display:'flex', alignItems:'center', gap:6 }}>
          <RefreshCw size={14} /> Refresh
        </button>
        {live && <span style={{ fontSize:11, color:'#00D2BE', display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:8, borderRadius:'50%', background:'#00D2BE', display:'inline-block' }} /> Live: {live.meeting_name || live.location} {live.session_name}</span>}
      </div>

      {!live && next && !meta && (
        <div style={{ background:'linear-gradient(135deg,#111,#1a1a1a)', border:'1px solid rgba(225,6,0,0.2)', borderRadius:16, padding:20, textAlign:'center' }}>
          <div style={{ fontSize:12, letterSpacing:'0.12em', color:'#e10600', fontWeight:800 }}>NEXT SESSION</div>
          <div style={{ fontSize:20, fontWeight:900, margin:'6px 0' }}>{next.meeting_name || next.location} — {next.session_name}</div>
          <div style={{ fontSize:13, color:'#999', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><Calendar size={14} /> {new Date(next.date_start).toLocaleString()} <Clock size={14} style={{ marginLeft:8 }} /> <Countdown dateStr={next.date_start} /></div>
        </div>
      )}

      {error && (
        <div style={{ background:'rgba(225,6,0,0.08)', border:'1px solid rgba(225,6,0,0.2)', borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:8, color:'#ff6b6b', fontSize:12 }}>
          <AlertTriangle size={16} /> {error} {error.includes('OpenF1') && '— OpenF1 may be down, try historical session.'}
        </div>
      )}

      {/* DESKTOP: LEFT map, RIGHT tower */}
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 0.9fr', gap:12, alignItems:'start' }} className="live-grid">
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <CircuitMap meetingName={meta?.meeting_name || meta?.location} cars={cars.map(c=>{ const row = rows.find(r=>r.abbr===c.abbr); return {...c, position: row?.position, team_color: row?.team_color || c.team_color, speed: c.speed ?? row?.speed}})} selected={selected} onSelect={setSelected} height={420} />
          <SelectedTelemetry car={selectedCar} row={selectedRow} />
          {/* Compact Race Control (Live) */}
          <div style={{ background:'#0a0a0a', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, overflow:'hidden' }}>
            <button onClick={()=>setRcOpen(v=>!v)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'rgba(255,255,255,0.03)', border:'none', color:'white', fontWeight:800, fontSize:12, letterSpacing:'0.06em', cursor:'pointer' }}>
              <span style={{ display:'flex', alignItems:'center', gap:6 }}><Flag size={12} color="#e10600"/> RACE CONTROL {raceEvents ? `• ${raceEvents.length}` : ''}</span>
              {rcOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </button>
            {rcOpen && <div style={{ padding:8, maxHeight:360, overflowY:'auto' }}><RaceControlFeed events={raceEvents?.slice(0,20) || []} selectedDriver={selected} /></div>}
          </div>
          <button onClick={()=>setDrawerOpen(v=>!v)} style={{ display:'none', padding:'10px', borderRadius:10, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'white', fontSize:12, fontWeight:800, alignItems:'center', justifyContent:'center', gap:6 }} className="mobile-drawer-btn">
            {drawerOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} {drawerOpen ? 'Hide Timing' : 'Show Timing Tower'}
          </button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:8 }} className="tower-desktop">
          {!rows || rows.length===0 ? (
            <div style={{ background:'rgba(255,255,255,0.03)', border:'1px dashed rgba(255,255,255,0.1)', borderRadius:12, padding:40, textAlign:'center', color:'#666' }}>
              <WifiOff size={24} style={{ margin:'0 auto 8px', opacity:0.5 }} />
              <div>No timing data for this session.</div>
              <div style={{ fontSize:11, marginTop:4 }}>Select a completed session to inspect historical data.</div>
            </div>
          ) : (
            <div style={{ borderRadius:12, border:'1px solid rgba(255,255,255,0.06)', background:'#0a0a0a', padding:8, maxHeight:600, overflowY:'auto' }}>
              <TimingTower rows={rows} sessionType={meta?.session_type} selected={selected} onSelect={setSelected} />
            </div>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div style={{ borderRadius:12, border:'1px solid rgba(255,255,255,0.06)', background:'#0a0a0a', padding:8 }}>
          <TimingTower rows={rows} sessionType={meta?.session_type} selected={selected} onSelect={setSelected} />
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .live-grid { grid-template-columns: 1fr !important; }
          .tower-desktop { display: ${drawerOpen ? 'none' : 'none'} !important; }
          .mobile-drawer-btn { display: flex !important; }
        }
        @media (min-width: 901px) {
          .mobile-drawer-btn { display: none !important; }
        }
      `}</style>

      <div style={{ fontSize:10, color:'#555', textAlign:'center' }}>Data: OpenF1 • Cars interpolate 400ms • No teleport • Stale &gt;5s greyed • Click tower ↔ map to select • Follow mode centers on driver</div>
    </div>
  )
}
