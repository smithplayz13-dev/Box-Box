import { Gauge, Activity, Fuel, Flag } from 'lucide-react'

function Item({ label, value, sub }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'8px 10px', minWidth:80 }}>
      <div style={{ fontSize:10, color:'#888', letterSpacing:'0.08em' }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:900, color:'white', fontVariantNumeric:'tabular-nums' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize:10, color:'#666' }}>{sub}</div>}
    </div>
  )
}

export default function SelectedTelemetry({ car, row }) {
  if (!car && !row) return (
    <div style={{ background:'#0a0a0a', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:16, textAlign:'center', color:'#666', fontSize:12 }}>
      Select a driver in the tower or tap a car on the map
    </div>
  )
  const data = { ...(row||{}), ...(car||{}) }
  const abbr = data.abbr || data.driver_abbr || '?'
  const teamColor = data.team_color || '#e10600'
  const speed = data.speed ?? 0
  const throttle = data.throttle
  const brake = data.brake
  const gear = data.gear ?? data.n_gear ?? '—'
  const drs = data.drs
  const compound = data.compound || 'UNKNOWN'
  const tyreAge = data.tyre_age
  const lap = data.current_lap ?? data.lap
  const pos = data.position ?? '?'


  return (
    <div style={{ background:'linear-gradient(180deg,#0f0f0f,#0a0a0a)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, padding:12, display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:36, height:36, borderRadius:8, background: teamColor, display:'flex', alignItems:'center', justifyContent:'center', color: teamColor==='#FFFFFF'?'black':'white', fontWeight:900 }}>{abbr}</div>
        <div>
          <div style={{ fontWeight:900, color:'white' }}>{data.full_name || abbr} <span style={{ color:'#999', fontWeight:600 }}>P{pos}</span></div>
          <div style={{ fontSize:11, color:'#999' }}>{data.team || ''}</div>
        </div>
        <span style={{ marginLeft:'auto', padding:'4px 8px', borderRadius:100, background: drs ? 'rgba(0,210,190,0.15)' : 'rgba(255,255,255,0.06)', color: drs ? '#00D2BE':'#666', fontSize:11, fontWeight:800 }}>DRS {drs ?? '—'}</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(90px,1fr))', gap:8 }}>
        <Item label="SPEED" value={`${Math.round(speed||0)} km/h`} sub={data.stale ? 'stale' : 'live'} />
        <Item label="THROTTLE" value={throttle!=null ? `${throttle}%` : '—'} />
        <Item label="BRAKE" value={brake!=null ? (brake ? 'ON':'OFF') : '—'} />
        <Item label="GEAR" value={gear} />
        <Item label="LAP" value={lap ?? '—'} />
        <Item label="TYRE" value={`${compound} ${tyreAge!=null? tyreAge+'L':''}`} />
        <Item label="SECTOR" value={`${data.s1!=null?Number(data.s1).toFixed(3):'—'} | ${data.s2!=null?Number(data.s2).toFixed(3):'—'} | ${data.s3!=null?Number(data.s3).toFixed(3):'—'}`} />
      </div>

      {/* throttle/brake bar */}
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <div style={{ flex:1, height:6, background:'rgba(255,255,255,0.08)', borderRadius:100, overflow:'hidden' }}>
          <div style={{ width:`${throttle||0}%`, height:'100%', background:'#00D2BE', transition:'width 0.3s' }} />
        </div>
        <span style={{ fontSize:10, color:'#999' }}>THR</span>
        <div style={{ width:40, height:6, background: brake ? '#E10600':'rgba(255,255,255,0.08)', borderRadius:100 }} />
        <span style={{ fontSize:10, color:'#999' }}>BRK</span>
      </div>
    </div>
  )
}
