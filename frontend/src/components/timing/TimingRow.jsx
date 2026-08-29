import { memo } from 'react'
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react'
import TyreBadge from './TyreBadge'
import SectorDisplay from './SectorDisplay'

function posChangeIcon(delta) {
  if (delta > 0) return <TrendingUp size={12} color="#00D2BE" />
  if (delta < 0) return <TrendingDown size={12} color="#E10600" />
  return <Minus size={12} color="#666" />
}

export default memo(function TimingRow({ row, index }) {
  // row: {position, abbr, full_name, team, team_color, gap_text, interval_text, last_lap, best_lap, is_pb, is_sb, s1,s2,s3, speed, compound, tyre_age, is_pit, in_pit}
  const isPit = row.is_pit || row.in_pit
  // visual state
  let bestStyle = {}
  let bestIcon = null
  if (row.is_sb) {
    bestStyle = { background:'#C800FF', color:'white', boxShadow:'0 0 10px rgba(200,0,255,0.4)' }
    bestIcon = '★ SB'
  } else if (row.is_pb) {
    bestStyle = { background:'#00D2BE', color:'black' }
    bestIcon = '▲ PB'
  } else if (row.last_lap === '—' || !row.last_lap) {
    bestStyle = { background:'rgba(255,255,255,0.06)', color:'#666' }
  }

  const gapStyle = row.position===1 ? { color:'#999' } : row.gap_text?.startsWith('+') ? {} : { color:'#666' }

  return (
    <div style={{
      display:'grid',
      gridTemplateColumns:'32px 70px 1fr 90px 90px 90px 110px 70px',
      gap:8,
      alignItems:'center',
      padding:'8px 10px',
      borderRadius:10,
      background: index%2===0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)',
      borderLeft:`4px solid ${row.team_color || '#444'}`,
      border: isPit ? '1px solid #FFB800' : '1px solid transparent',
      opacity: row.last_lap==='—' ? 0.6 : 1,
      fontFamily:"'Space Grotesk',sans-serif"
    }}>
      <div style={{ fontWeight:900, color:'white', fontSize:14, textAlign:'center' }}>{row.position}</div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ width:26, height:26, borderRadius:6, background: row.team_color || '#333', color: row.team_color==='#FFFFFF' ? 'black':'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900 }}>{row.abbr}</span>
        <span style={{ fontSize:12, color:'white', fontWeight:700, display:'none' }} className="hidden sm:inline">{row.abbr}</span>
      </div>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:12, color:'white', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{row.full_name}</div>
        <div style={{ fontSize:10, color:'#888', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{row.team} {isPit && <span style={{ color:'#FFB800', marginLeft:4 }}><AlertCircle size={10} style={{ display:'inline' }} /> PIT</span>}</div>
      </div>
      <div style={{ fontVariantNumeric:'tabular-nums', fontSize:12, color:'white', textAlign:'right', ...gapStyle }}>{row.gap_text}</div>
      <div style={{ fontVariantNumeric:'tabular-nums', fontSize:12, color:'white', textAlign:'center', padding:'2px 6px', borderRadius:6, ...bestStyle }}>
        {row.best_lap} {bestIcon && <span style={{ fontSize:9, marginLeft:4 }}>{bestIcon}</span>}
      </div>
      <div style={{ fontVariantNumeric:'tabular-nums', fontSize:12, color: row.is_pb ? '#00D2BE' : row.is_sb ? '#C800FF' : 'white', textAlign:'center', background: row.is_pb ? 'rgba(0,210,190,0.08)' : row.is_sb ? 'rgba(200,0,255,0.08)' : 'transparent', borderRadius:6, padding:'2px 4px' }}>
        {row.last_lap} {row.is_pb && <span style={{ color:'#00D2BE' }}>●</span>} {row.is_sb && <span style={{ color:'#C800FF' }}>●</span>}
      </div>
      <div style={{ display:'flex', justifyContent:'center' }}>
        <TyreBadge compound={row.compound} age={row.tyre_age} />
      </div>
      <div style={{ fontSize:11, color:'#999', textAlign:'right', fontVariantNumeric:'tabular-nums', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:4 }}>
        {row.speed ? `${row.speed}km/h` : '—'}
      </div>
    </div>
  )
})
