import { memo, useMemo, useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const FILTERS = {
  All: () => true,
  Flags: e => ['green_flag','yellow_flag','double_yellow','red_flag','chequered','flag'].includes(e.type),
  'Pit Stops': e => e.type==='pit_stop' || e.type==='pit_lane',
  Drivers: e => !!e.abbr,
  Strategy: e => ['drs_enabled','drs_disabled','pit_stop','pit_lane'].includes(e.type),
  Session: e => ['session_start','session_pause','session_restart','chequered'].includes(e.type),
}

function EventRow({ e, isNew }) {
  const colorMap = {
    red_flag: '#e10600',
    safety_car: '#FFB800',
    virtual_safety_car: '#FFB800',
    yellow_flag: '#FFB800',
    double_yellow: '#FFB800',
    green_flag: '#00D2BE',
    pit_stop: '#00D2BE',
    fastest_lap: '#C800FF',
    drs_enabled: '#00D2BE',
    drs_disabled: '#666',
    penalty: '#FF6B00',
  }
  const accent = colorMap[e.type] || (e.severity==='critical' ? '#e10600' : e.severity==='warning' ? '#FFB800' : '#666')
  return (
    <motion.div
      initial={isNew ? { opacity:0, y:-10, scale:0.98 } : false}
      animate={{ opacity:1, y:0, scale:1 }}
      transition={{ duration:0.3 }}
      style={{
        display:'grid',
        gridTemplateColumns:'56px 1fr',
        gap:10,
        padding:'10px 12px',
        background: isNew ? 'rgba(225,6,0,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isNew ? 'rgba(225,6,0,0.18)' : 'rgba(255,255,255,0.06)'}`,
        borderLeft: `4px solid ${accent}`,
        borderRadius:10,
      }}
    >
      <div style={{ fontVariantNumeric:'tabular-nums', fontSize:11, color:'#999', fontWeight:700 }}>{e.time_label || '--:--'}</div>
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <span style={{ fontSize:14 }} aria-hidden>{e.icon}</span>
          <span style={{ fontSize:12, fontWeight:900, color:'white', letterSpacing:'0.04em' }}>{e.title}</span>
          {e.abbr && <span style={{ fontSize:11, fontWeight:800, background: 'rgba(255,255,255,0.08)', padding:'1px 6px', borderRadius:6, color:'white' }}>{e.abbr}</span>}
          {e.lap && <span style={{ fontSize:10, color:'#666' }}>Lap {e.lap}</span>}
          {e.sector && <span style={{ fontSize:10, color:'#666' }}>Sector {e.sector}</span>}
        </div>
        <div style={{ fontSize:11, color:'#999', marginTop:2, lineHeight:1.4 }}>{e.message}</div>
      </div>
    </motion.div>
  )
}

export default memo(function RaceControlFeed({ events, selectedDriver }) {
  const [filter, setFilter] = useState('All')
  const [driverFilter, setDriverFilter] = useState(null)
  const prevIdsRef = useRef(new Set())
  const [newIds, setNewIds] = useState(new Set())

  const filtered = useMemo(()=>{
    let list = events || []
    const fn = FILTERS[filter] || FILTERS.All
    list = list.filter(fn)
    const df = driverFilter || selectedDriver
    if (df) list = list.filter(e=> e.abbr===df)
    return list
  },[events, filter, driverFilter, selectedDriver])

  // track new events for animation (only animate newly received)
  useEffect(()=>{
    const prev = prevIdsRef.current
    const incoming = new Set(events?.map(e=>e.id) || [])
    const added = new Set([...incoming].filter(id=>!prev.has(id)))
    if (added.size>0) {
      setNewIds(added)
      const t = setTimeout(()=> setNewIds(new Set()), 3000)
      prevIdsRef.current = incoming
      return ()=>clearTimeout(t)
    }
    prevIdsRef.current = incoming
  },[events])

  if (!events) return <div style={{ padding:20, textAlign:'center', color:'#666' }}>Loading Race Control…</div>
  if (events.length===0) return <div style={{ padding:24, textAlign:'center', color:'#666', border:'1px dashed rgba(255,255,255,0.1)', borderRadius:12 }}>No Race Control messages for this session.</div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
        {Object.keys(FILTERS).map(k=>(
          <button key={k} onClick={()=>setFilter(k)} style={{ padding:'4px 10px', borderRadius:100, fontSize:11, fontWeight:800, background: filter===k?'#e10600':'rgba(255,255,255,0.06)', color: filter===k?'white':'#999', border:'1px solid rgba(255,255,255,0.08)', textTransform:'uppercase' }}>{k}</button>
        ))}
        <select value={driverFilter||selectedDriver||''} onChange={e=>setDriverFilter(e.target.value||null)} style={{ marginLeft:'auto', background:'#1a1a1a', color:'white', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'4px 8px', fontSize:11 }}>
          <option value="">All drivers</option>
          {[...new Set(events.map(e=>e.abbr).filter(Boolean))].sort().map(abbr=> <option key={abbr} value={abbr}>{abbr}</option>)}
        </select>
        {driverFilter && <button onClick={()=>setDriverFilter(null)} style={{ fontSize:11, color:'#e10600', background:'none', border:'none', cursor:'pointer' }}>Clear</button>}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:600, overflowY:'auto', paddingRight:4 }}>
        <AnimatePresence initial={false}>
          {filtered.map(e=> <EventRow key={e.id} e={e} isNew={newIds.has(e.id)} />)}
        </AnimatePresence>
        {filtered.length===0 && <div style={{ padding:20, textAlign:'center', color:'#666', fontSize:12 }}>No events for this filter.</div>}
      </div>
    </div>
  )
})
