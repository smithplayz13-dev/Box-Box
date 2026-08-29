import { memo, useMemo, useState } from 'react'
import TimingRow from './TimingRow'

const sortFns = {
  position: (a,b)=> a.position - b.position,
  driver: (a,b)=> a.abbr.localeCompare(b.abbr),
  gap: (a,b)=> (a.gap ?? 999) - (b.gap ?? 999),
  best: (a,b)=> (a.best_lap_sec ?? 999) - (b.best_lap_sec ?? 999),
  last: (a,b)=> (a.last_lap_sec ?? 999) - (b.last_lap_sec ?? 999),
  tyre: (a,b)=> (a.compound||'').localeCompare(b.compound||''),
}

export default memo(function TimingTower({ rows, sessionType, selected, onSelect }) {
  const [sortKey, setSortKey] = useState('position')
  const sorted = useMemo(()=>{
    const fn = sortFns[sortKey] || sortFns.position
    return [...(rows||[])].sort(fn)
  }, [rows, sortKey])

  if (!rows || rows.length===0) {
    return <div style={{ padding:40, textAlign:'center', color:'#666' }}>No timing data — session has not started or OpenF1 has no data.</div>
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', fontFamily:"'Space Grotesk',sans-serif" }}>
        <span style={{ fontSize:11, color:'#666', letterSpacing:'0.06em' }}>SORT BY</span>
        {Object.keys(sortFns).map(k=>(
          <button key={k} onClick={()=>setSortKey(k)} style={{
            padding:'4px 10px', borderRadius:100, fontSize:11, fontWeight:800, letterSpacing:'0.06em',
            background: sortKey===k ? '#e10600' : 'rgba(255,255,255,0.06)', color: sortKey===k ? 'white':'#999',
            border:'1px solid rgba(255,255,255,0.08)', textTransform:'uppercase'
          }}>{k}</button>
        ))}
        <span style={{ marginLeft:'auto', fontSize:10, color:'#666' }}>{rows.length} drivers • {sessionType||''}</span>
      </div>

      {/* Header */}
      <div style={{ display:'grid', gridTemplateColumns:'32px 70px 1fr 90px 90px 90px 110px 70px', gap:8, padding:'6px 10px', fontSize:10, color:'#666', letterSpacing:'0.08em', fontFamily:"'Space Grotesk',sans-serif" }}>
        <span style={{ textAlign:'center' }}>P</span>
        <span>DRIVER</span>
        <span>TEAM</span>
        <span style={{ textAlign:'right' }}>GAP</span>
        <span style={{ textAlign:'center' }}>BEST</span>
        <span style={{ textAlign:'center' }}>LAST</span>
        <span style={{ textAlign:'center' }}>TYRE</span>
        <span style={{ textAlign:'right' }}>SPD</span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {sorted.map((r,i)=><TimingRow key={r.abbr} row={r} index={i} selected={selected===r.abbr} onSelect={onSelect} />)}
      </div>

      <div style={{ fontSize:10, color:'#666', display:'flex', gap:10, flexWrap:'wrap', marginTop:6 }}>
        <span><span style={{ display:'inline-block', width:10, height:10, background:'#C800FF', borderRadius:3, verticalAlign:'middle', marginRight:4 }} /> purple = session best ★ SB</span>
        <span><span style={{ display:'inline-block', width:10, height:10, background:'#00D2BE', borderRadius:3, verticalAlign:'middle', marginRight:4 }} /> green = personal best ▲ PB</span>
        <span><span style={{ display:'inline-block', width:10, height:10, background:'#FFB800', borderRadius:3, verticalAlign:'middle', marginRight:4 }} /> yellow border = pit</span>
      </div>
    </div>
  )
})
