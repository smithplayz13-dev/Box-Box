export default function TyreBadge({ compound, age }) {
  const map = {
    SOFT: { bg:'#E10600', color:'white', label:'S' },
    MEDIUM: { bg:'#FFB800', color:'black', label:'M' },
    HARD: { bg:'#F0F0F0', color:'black', label:'H' },
    INTERMEDIATE: { bg:'#00A651', color:'white', label:'I' },
    WET: { bg:'#0072CE', color:'white', label:'W' },
    UNKNOWN: { bg:'#444', color:'white', label:'?' },
  }
  const cfg = map[(compound||'UNKNOWN').toUpperCase()] || map.UNKNOWN
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
      <span style={{ width:22, height:22, borderRadius:6, background: cfg.bg, color: cfg.color, fontSize:11, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid rgba(255,255,255,0.15)' }}>{cfg.label}</span>
      {age != null && age !== '' && <span style={{ fontSize:11, color:'#999', fontVariantNumeric:'tabular-nums' }}>{age}L</span>}
    </span>
  )
}
