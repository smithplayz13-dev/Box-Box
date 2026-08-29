import { memo } from 'react'

function fmt(v) {
  if (v == null || v === 0 || v === '') return '—'
  const n = Number(v)
  if (isNaN(n) || n===0) return '—'
  return n.toFixed(3)
}

export default memo(function SectorDisplay({ s1, s2, s3, bestSectors }) {
  // bestSectors not yet wired — placeholder for purple SB
  return (
    <span style={{ display:'inline-flex', gap:6, fontFamily:"'JetBrains Mono','Space Grotesk', monospace", fontSize:12, fontVariantNumeric:'tabular-nums' }}>
      <span style={{ color:'#999', background: 'rgba(255,255,255,0.04)', padding:'2px 6px', borderRadius:4, minWidth:54, textAlign:'center' }}>{fmt(s1)}</span>
      <span style={{ color:'#999', background: 'rgba(255,255,255,0.04)', padding:'2px 6px', borderRadius:4, minWidth:54, textAlign:'center' }}>{fmt(s2)}</span>
      <span style={{ color:'#999', background: 'rgba(255,255,255,0.04)', padding:'2px 6px', borderRadius:4, minWidth:54, textAlign:'center' }}>{fmt(s3)}</span>
    </span>
  )
})
