import { CIRCUIT_DATA, getCircuitInfo } from '../utils/circuitData'

// Extensible circuit map system — SVG-based
// Each entry can override outline, racing line, sectors, DRS, pit lane
const MAPS = {
  'BAHRAIN GP': { svg: CIRCUIT_DATA['BAHRAIN GP']?.svgPath, drs: [[280,100],[350,150]], sectors: [{t:0.33},{t:0.66}] },
  'AUSTRALIAN GP': { svg: CIRCUIT_DATA['AUSTRALIAN GP']?.svgPath },
  'JAPANESE GP': { svg: CIRCUIT_DATA['JAPANESE GP']?.svgPath },
  'MONACO GP': { svg: CIRCUIT_DATA['MONACO GP']?.svgPath },
  'BRITISH GP': { svg: CIRCUIT_DATA['BRITISH GP']?.svgPath },
  'ITALIAN GP': { svg: CIRCUIT_DATA['ITALIAN GP']?.svgPath },
  'BELGIAN GP': { svg: CIRCUIT_DATA['BELGIAN GP']?.svgPath },
  'SINGAPORE GP': { svg: CIRCUIT_DATA['SINGAPORE GP']?.svgPath },
}

export function getCircuitMap(meetingName) {
  if (!meetingName) return getFallback()
  const key = meetingName.toUpperCase()
  // try direct
  for (const k of Object.keys(MAPS)) {
    if (key.includes(k.replace(' GP','')) || k.includes(key.replace(' GRAND PRIX',''))) {
      const info = getCircuitInfo(meetingName)
      const m = MAPS[k]
      return {
        svgPath: m.svg || info.svgPath,
        circuitName: info.circuitName,
        info,
        drsZones: m.drs || [],
        sectors: m.sectors || [{t:0.33},{t:0.66}],
        pitLane: null,
      }
    }
  }
  return getFallback(meetingName)
}

function getFallback(name='Generic') {
  const info = getCircuitInfo(name)
  return {
    svgPath: info.svgPath,
    circuitName: info.circuitName,
    info,
    drsZones: [],
    sectors: [{t:0.33},{t:0.66}],
    pitLane: null,
    isFallback: true,
  }
}
