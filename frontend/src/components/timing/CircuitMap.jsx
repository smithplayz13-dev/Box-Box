import { useMemo, useState, useRef, useEffect, memo } from 'react'
import { ZoomIn, ZoomOut, Maximize2, Crosshair, Eye, EyeOff, Map as MapIcon } from 'lucide-react'
import { getCircuitMap } from '../../circuitMaps'

// Maps OpenF1 x/y (track meters) to SVG 0-1000 viewBox via bounds
function normalizePositions(cars, width=1000, height=500, padding=40) {
  if (!cars || cars.length===0) return []
  const xs = cars.map(c=>c.x).filter(v=>typeof v==='number')
  const ys = cars.map(c=>c.y).filter(v=>typeof v==='number')
  if (xs.length===0) return cars.map(c=>({...c, sx: width/2, sy: height/2}))
  let minX = Math.min(...xs), maxX = Math.max(...xs)
  let minY = Math.min(...ys), maxY = Math.max(...ys)
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const scale = Math.min((width-2*padding)/rangeX, (height-2*padding)/rangeY)
  const offX = (width - rangeX*scale)/2 - minX*scale
  const offY = (height - rangeY*scale)/2 - minY*scale
  return cars.map(c=> ({
    ...c,
    sx: c.x*scale + offX,
    sy: c.y*scale + offY,
  }))
}

// Smooth interpolation hook
function useInterpolated(cars, enabled=true){
  const prevRef = useRef(new Map())
  const [display, setDisplay] = useState([])
  const rafRef = useRef(null)

  useEffect(()=>{
    if (!enabled || !cars || cars.length===0) {
      if (!enabled && cars) setDisplay(normalizePositions(cars))
      return
    }
    const now = performance.now()
    cars.forEach(c=> prevRef.current.set(c.abbr, { ...c, _t: now, _prev: prevRef.current.get(c.abbr) || c }))
    const animate = ()=>{
      const t = performance.now()
      const out = []
      prevRef.current.forEach((v, k)=>{
        const target = cars.find(x=>x.abbr===k)
        if (!target) return
        const prev = v._prev || target
        const dur = 400
        const p = Math.min(1, (t - v._t)/dur)
        const stale = (Date.now() - new Date(target.date||0).getTime()) > 5000
        const x = stale ? target.x : prev.x + (target.x - prev.x)*p
        const y = stale ? target.y : prev.y + (target.y - prev.y)*p
        out.push({ ...target, x, y, _stale: stale })
      })
      setDisplay(normalizePositions(out))
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return ()=> cancelAnimationFrame(rafRef.current)
  },[cars, enabled])

  return display
}

export default memo(function CircuitMap({ meetingName, cars, selected, onSelect, height=380 }){
  const map = useMemo(()=> getCircuitMap(meetingName), [meetingName])
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({x:0,y:0})
  const [showLabels, setShowLabels] = useState(true)
  const [showDRS, setShowDRS] = useState(true)
  const [showSectors, setShowSectors] = useState(true)
  const [follow, setFollow] = useState(false)
  const containerRef = useRef(null)

  const displayCars = useInterpolated(cars, true)

  // follow selected driver: center view on its sx/sy
  const view = useMemo(()=>{
    if (follow && selected) {
      const c = displayCars.find(x=>x.abbr===selected)
      if (c) {
        return { x: 500 - c.sx*zoom, y: 250 - c.sy*zoom, scale: zoom }
      }
    }
    return { x: pan.x, y: pan.y, scale: zoom }
  },[follow, selected, displayCars, zoom, pan])

  // drag to pan
  const dragRef = useRef(null)
  const onPointerDown = (e)=>{
    if (follow) return
    dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }
  const onPointerMove = (e)=>{
    if (!dragRef.current || follow) return
    setPan({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y })
  }
  const onPointerUp = ()=> dragRef.current=null

  return (
    <div style={{ background:'#0a0a0a', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, overflow:'hidden', display:'flex', flexDirection:'column' }}>
      {/* Controls */}
      <div style={{ display:'flex', gap:6, padding:8, background:'rgba(255,255,255,0.03)', borderBottom:'1px solid rgba(255,255,255,0.06)', flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:11, fontWeight:800, color:'#999', letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:4 }}><MapIcon size={12} /> {map.circuitName}</span>
        <span style={{ flex:1 }} />
        <button onClick={()=>setZoom(z=>Math.min(3, z*1.2))} style={btnStyle}><ZoomIn size={14}/></button>
        <button onClick={()=>setZoom(z=>Math.max(0.6, z/1.2))} style={btnStyle}><ZoomOut size={14}/></button>
        <button onClick={()=>{setZoom(1); setPan({x:0,y:0}); setFollow(false)}} style={btnStyle}><Maximize2 size={14}/></button>
        <button onClick={()=>setFollow(f=>!f)} style={{...btnStyle, background: follow?'#e10600':'rgba(255,255,255,0.06)', color: follow?'white':'#999'}}><Crosshair size={14}/> {follow?'Follow':'Follow'}</button>
        <button onClick={()=>setShowLabels(v=>!v)} style={btnStyle}>{showLabels ? <Eye size={14}/> : <EyeOff size={14}/>} Labels</button>
        <button onClick={()=>setShowDRS(v=>!v)} style={btnStyle}>DRS</button>
        <button onClick={()=>setShowSectors(v=>!v)} style={btnStyle}>Sectors</button>
      </div>

      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ height, position:'relative', background:'radial-gradient(600px 300px at 50% 50%, #151515, #070707)', overflow:'hidden', cursor: follow ? 'default' : 'grab', touchAction:'none' }}
      >
        <svg viewBox="0 0 1000 500" style={{ width:'100%', height:'100%', display:'block' }}>
          <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            {/* Track outline */}
            <path d={map.svgPath} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
            <path d={map.svgPath} fill="none" stroke="#2a2a2a" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
            {/* Racing line (dashed) */}
            <path d={map.svgPath} fill="none" stroke="rgba(225,6,0,0.35)" strokeWidth={2} strokeDasharray="8 8" opacity={0.6} />
            {/* Sectors */}
            {showSectors && map.sectors.map((s,i)=> (
              <circle key={i} cx={200 + i*200} cy={250} r={4} fill={i===0?'#FFB800': i===1?'#00D2BE':'#C800FF'} stroke="white" strokeWidth={1} opacity={0.9} />
            ))}
            {/* DRS zones */}
            {showDRS && map.drsZones.map((seg,i)=> (
              <line key={i} x1={seg[0]} y1={seg[1]} x2={seg[0]+40} y2={seg[1]} stroke="#00D2BE" strokeWidth={4} strokeDasharray="4 4" opacity={0.8} />
            ))}
            {/* Start/finish */}
            <g transform="translate(80,250) rotate(-10)">
              <rect x={-10} y={-14} width={20} height={28} fill="white" stroke="black" strokeWidth={0.5} />
              {/* checker */}
              <rect x={-10} y={-14} width={10} height={7} fill="black" /><rect x={0} y={-7} width={10} height={7} fill="black" /><rect x={-10} y={7} width={10} height={7} fill="black" /><rect x={0} y={0} width={10} height={7} fill="white" />
            </g>

            {/* Cars */}
            {displayCars.map(car=> {
              const isSel = car.abbr===selected
              const isStale = car._stale
              return (
                <g key={car.abbr} onClick={()=>onSelect && onSelect(car.abbr)} style={{ cursor:'pointer', opacity: isStale?0.35:1 }}>
                  <circle cx={car.sx} cy={car.sy} r={isSel?18:13} fill={car.team_color || '#e10600'} stroke={isSel?'white':'rgba(0,0,0,0.6)'} strokeWidth={isSel?2.5:1.5} />
                  <text x={car.sx} y={car.sy+1} textAnchor="middle" fontSize={isSel?9:8} fontWeight={900} fill={car.team_color==='#FFFFFF' ? 'black':'white'} style={{ pointerEvents:'none' }}>{car.abbr}</text>
                  <text x={car.sx} y={car.sy-16} textAnchor="middle" fontSize={9} fontWeight={900} fill="white" stroke="black" strokeWidth={3} paintOrder="stroke" style={{ pointerEvents:'none' }}>P{car.position || '?'}</text>
                  {showLabels && <text x={car.sx+14} y={car.sy-10} fontSize={8} fill="rgba(255,255,255,0.7)">{Math.round(car.speed||0)}km/h</text>}
                  {isSel && <circle cx={car.sx} cy={car.sy} r={22} fill="none" stroke="white" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />}
                </g>
              )
            })}
          </g>
        </svg>

        {map.isFallback && <div style={{ position:'absolute', top:8, right:8, fontSize:10, color:'#666', background:'rgba(0,0,0,0.5)', padding:'4px 8px', borderRadius:100 }}>Generic map — fallback</div>}
        {displayCars.length===0 && <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#666', fontSize:12 }}>No position data — waiting for OpenF1…</div>}
      </div>
    </div>
  )
})

const btnStyle = { padding:'5px 8px', borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#ccc', fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', gap:4, cursor:'pointer' }
