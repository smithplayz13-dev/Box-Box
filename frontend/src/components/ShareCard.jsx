import React, { useState, useEffect } from 'react';
import { getDriverImage } from '../utils/driverImages';

const hexToRgba = (hex, alpha = 1) => {
  if (!hex) return `rgba(255, 255, 255, ${alpha})`;
  let value = hex.replace('#', '');
  if (value.length === 3) {
    value = value.split('').map((char) => char + char).join('');
  }
  if (value.length !== 6) return `rgba(255, 255, 255, ${alpha})`;

  const num = Number.parseInt(value, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// ── Team colour lookup ────────────────────────────────────────────────────────
const getShareTeamColor = (team = '') => {
  const map = {
    'Red Bull Racing':  '#3671C6',
    'Red Bull':         '#3671C6',
    'Scuderia Ferrari': '#E8002D',
    'Ferrari':          '#E8002D',
    'McLaren F1 Team':  '#FF8000',
    'McLaren':          '#FF8000',
    'Mercedes':         '#27F4D2',
    'Aston Martin':     '#229971',
    'Alpine F1 Team':   '#0093CC',
    'Alpine':           '#0093CC',
    'Williams Racing':  '#64C4FF',
    'Williams':         '#64C4FF',
    'Haas F1 Team':     '#B6BABD',
    'Haas':             '#B6BABD',
    'RB F1 Team':       '#6692FF',
    'VCARB':            '#6692FF',
    'Kick Sauber':      '#52E252',
    'Sauber':           '#52E252',
  };
  return map[team] || '#E10600';
};

// ── Base64 image loader (bypasses CORS for share card rendering) ──────────────
async function fetchBase64(url) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Corner bracket helper ─────────────────────────────────────────────────────
function CornerBracket({ pos }) {
  const base = { position: 'absolute', zIndex: 10 };
  const bar  = { background: '#E10600', borderRadius: 1 };
  const offsets = {
    tl: { top: 20, left: 20 },
    tr: { top: 20, right: 20 },
    bl: { bottom: 20, left: 20 },
    br: { bottom: 20, right: 20 },
  }[pos];
  const isRight  = pos.endsWith('r');
  const isBottom = pos.startsWith('b');

  return (
    <div style={{ ...base, ...offsets }}>
      <div style={{ ...bar, width: 35, height: 2, position: 'absolute',
        top: isBottom ? 'auto' : 0, bottom: isBottom ? 0 : 'auto',
        left: isRight ? 'auto' : 0, right: isRight ? 0 : 'auto' }} />
      <div style={{ ...bar, width: 2, height: 35, position: 'absolute',
        top: isBottom ? 'auto' : 0, bottom: isBottom ? 0 : 'auto',
        left: isRight ? 'auto' : 0, right: isRight ? 0 : 'auto' }} />
    </div>
  );
}

// ── Podium column ─────────────────────────────────────────────────────────────
function PodiumCol({ driver, isWinner, driverImage }) {
  const color = getShareTeamColor(driver.team);
  const pos   = driver.pos;

  const posAccent = pos === 1 ? '#FFD700' : pos === 2 ? '#C0C0C0' : '#CD7F32';
  const posLabel  = pos === 1 ? 'WINNER'  : `P${pos}`;
  const flex      = isWinner ? 1.5 : 1;
  const nameSz    = isWinner ? 44 : 28;
  const ptsSz     = isWinner ? 50 : 32;
  const cardBg    = isWinner ? '#161616' : '#121212';

  // Content zone height is ~200px for winner, ~160px for sides
  const contentH  = isWinner ? 200 : 160;
  const imgH      = isWinner ? 420 : 280;
  const imgBottom = isWinner ? contentH - 10 : contentH - 10;
  const fadeBottom = contentH - 15;

  return (
    <div style={{
      flex,
      position: 'relative',
      background: `linear-gradient(180deg, ${cardBg} 0%, #0c0c0c 100%)`,
      borderTop: `3px solid ${posAccent}`,
      borderRadius: 6,
      margin: '8px 6px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
    }}>
      {/* ── Ghost position number (fills empty upper area) ── */}
      <div style={{
        position: 'absolute',
        top: isWinner ? -60 : -30,
        right: isWinner ? -25 : -15,
        fontSize: isWinner ? 380 : 240,
        fontWeight: 900,
        fontStyle: 'italic',
        color: hexToRgba(posAccent, isWinner ? 0.05 : 0.035),
        lineHeight: 1,
        fontFamily: "'Space Grotesk', sans-serif",
        userSelect: 'none',
        zIndex: 0,
      }}>{pos}</div>

      {/* ── Team colour splash ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: isWinner ? '60%' : '50%',
        background: `linear-gradient(180deg, ${hexToRgba(color, isWinner ? 0.21 : 0.12)}, transparent)`,
        zIndex: 0,
      }} />

      {/* ── Speed line pattern (fills upper area) ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '65%',
        backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.02) 8px, rgba(255,255,255,0.02) 9px)`,
        zIndex: 0,
      }} />

      {/* ── Lens flare for winner ── */}
      {isWinner && (
        <div style={{
          position: 'absolute', top: 28, right: 24,
          width: 120, height: 120,
          background: 'radial-gradient(circle, rgba(255, 215, 0, 0.25), transparent)',
          borderRadius: '50%', zIndex: 1,
        }} />
      )}

      {/* ── Driver photo (absolute, filling upper card) ── */}
      {driverImage && (
        <>
          <img
            src={driverImage}
            alt={driver.name}
            loading="lazy"
            decoding="async"
            style={{
              position: 'absolute',
              bottom: imgBottom,
              left: '50%',
              transform: 'translateX(-50%)',
              height: imgH,
              width: 'auto',
              objectFit: 'contain',
              objectPosition: 'bottom center',
              zIndex: 2,
              filter: 'contrast(1.05) saturate(0.9)',
            }}
          />
          {/* Gradient fade so photo blends into text */}
          <div style={{
            position: 'absolute',
            bottom: fadeBottom,
            left: 0, right: 0,
            height: 120,
            background: `linear-gradient(transparent, ${cardBg})`,
            zIndex: 3,
          }} />
        </>
      )}

      {/* ── Fallback: large outlined driver code when no photo ── */}
      {!driverImage && (
        <div style={{
          position: 'absolute',
          top: '15%', left: 0, right: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 2,
        }}>
          <div style={{
            fontSize: isWinner ? 160 : 110,
            fontWeight: 900,
            fontStyle: 'italic',
            fontFamily: "'Space Grotesk', sans-serif",
            color: 'transparent',
            WebkitTextStroke: `2px ${color}`,
            opacity: 0.6,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            textAlign: 'center',
            userSelect: 'none',
          }}>{driver.code}</div>
        </div>
      )}

      {/* ── Content ── */}
      <div style={{
        position: 'relative',
        padding: isWinner ? '0 22px 22px' : '0 16px 16px',
        zIndex: 4,
      }}>
        {/* Position badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: hexToRgba(posAccent, 0.13),
          border: `1px solid ${hexToRgba(posAccent, 0.4)}`,
          borderRadius: 20, padding: '4px 12px',
          marginBottom: 10,
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: posAccent,
            fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            {posLabel}
          </span>
        </div>

        {/* Flag + Driver name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <img
            src={`https://flagcdn.com/w40/${DRIVER_FLAG_CODES[driver.code] || 'xx'}.png`}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ width: 28, height: 21, borderRadius: 2, objectFit: 'cover' }}
            crossOrigin="anonymous"
          />
          <div style={{
            fontSize: nameSz, fontWeight: 900, color: '#fff',
            fontFamily: "'Space Grotesk', sans-serif",
            lineHeight: 1.05, textTransform: 'uppercase',
            letterSpacing: '-0.02em',
          }}>{driver.name}</div>
        </div>

        {/* Team */}
        <div style={{
          fontSize: 13, color, fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.1em', marginBottom: 10,
        }}>{driver.team}</div>

        {/* Points */}
        <div style={{
          fontSize: ptsSz, fontWeight: 900, color: posAccent,
          fontFamily: "'Space Grotesk', sans-serif",
          letterSpacing: '-0.02em',
        }}>{driver.pts} <span style={{ fontSize: ptsSz * 0.45, fontWeight: 700, opacity: 0.7 }}>PTS</span></div>

        {/* Team colour bottom bar */}
        <div style={{ height: 3, background: color, borderRadius: 2, marginTop: 12 }} />
      </div>
    </div>
  );
}

// ── Main ShareCard (1080×1080 or 1080×1350) ────────────────────────────────────
export default function ShareCard({ raceData, format = 'square', cardId = 'share-card', exportMode = false }) {
  const { raceName, round, year, p1, p2, p3, fastestLap } = raceData;
  const [driverImages, setDriverImages] = useState({});

  // Load driver images as base64 to bypass CORS for share card rendering
  useEffect(() => {
    let cancelled = false;
    const loadImages = async () => {
      const images = {};
      for (const driver of [p1, p2, p3]) {
        if (!driver?.code) continue;
        const url = getDriverImage(driver.code);
        if (!url) continue;
        const b64 = await fetchBase64(url);
        if (!cancelled && b64) images[driver.code] = b64;
      }
      if (!cancelled) setDriverImages(images);
    };
    loadImages();
    return () => { cancelled = true; };
  }, [p1, p2, p3]);

  const d1 = { ...p1, pos: 1 };
  const d2 = { ...p2, pos: 2 };
  const d3 = { ...p3, pos: 3 };

  const W = 1080, H = format === 'portrait' ? 1350 : 1080;

  return (
    <div
      id={cardId}
      style={{
        width: W, height: H,
        background: '#080808',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        isolation: 'isolate',
      }}
    >
      {/* ── Background Layers ── */}
      {/* Red radial glow */}
      <div style={{
        position: 'absolute', top: -120, left: '50%',
        transform: 'translateX(-50%)',
        width: 960, height: 660,
        background: 'radial-gradient(ellipse, rgba(225, 6, 0, 0.25) 0%, rgba(225, 6, 0, 0.06) 35%, transparent 65%)',
        zIndex: 0, pointerEvents: 'none',
      }} />

      {/* Carbon fiber crosshatch */}
      {!exportMode && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.012) 2px, rgba(255,255,255,0.012) 4px)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Scanline overlay */}
      {!exportMode && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.008) 3px, rgba(255,255,255,0.008) 4px)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Corner brackets */}
      {['tl','tr','bl','br'].map(p => <CornerBracket key={p} pos={p} />)}

      {/* ── TOP SECTION ── */}
      <div style={{ position: 'relative', zIndex: 2, paddingTop: 0 }}>
        {/* Gradient bar */}
        <div style={{
          height: 6,
          background: 'linear-gradient(90deg, #E10600 0%, #FF6B00 40%, transparent 80%)',
        }} />

        {/* Race name block */}
        <div style={{
          textAlign: 'center', paddingTop: 22, paddingBottom: 14,
          paddingLeft: 80, paddingRight: 80,
        }}>
          <div style={{
            fontSize: 46, fontWeight: 900, color: '#fff',
            textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.1,
          }}>{raceName}</div>
          <div style={{
            fontSize: 16, color: '#555', letterSpacing: '0.18em',
            textTransform: 'uppercase', marginTop: 6, fontWeight: 600,
          }}>{year} · {round}</div>
        </div>
      </div>

      {/* ── MIDDLE — PODIUM ── */}
      <div style={{
        flex: 1, zIndex: 2, position: 'relative',
        display: 'flex', gap: 0,
        padding: '0 8px',
      }}>
        <PodiumCol driver={d2} isWinner={false} driverImage={driverImages[d2.code]} />
        <PodiumCol driver={d1} isWinner={true}  driverImage={driverImages[d1.code]} />
        <PodiumCol driver={d3} isWinner={false} driverImage={driverImages[d3.code]} />
      </div>

      {/* ── DIVIDER ── */}
      <div style={{
        height: 1, zIndex: 2, position: 'relative',
        background: 'linear-gradient(90deg, transparent, #333 30%, #333 70%, transparent)',
        margin: '0 16px',
      }} />

      {/* ── BOTTOM STRIP ── */}
      <div style={{
        height: 110, zIndex: 2, position: 'relative',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
      }}>
        {/* Fastest Lap */}
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(124, 58, 237, 0.12)',
            border: '1px solid #7C3AED',
            borderRadius: 20, padding: '7px 16px',
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 800,
              letterSpacing: '0.1em', textTransform: 'uppercase' }}>⚡ FASTEST LAP</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
            {fastestLap?.driver}
            <span style={{ color: '#666', fontWeight: 400, fontSize: 16 }}> — {fastestLap?.time}</span>
          </div>
        </div>

        {/* Branding */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff',
            letterSpacing: '-0.01em' }}>🏁 BoxBox</div>
          <div style={{ fontSize: 13, color: '#444', letterSpacing: '0.12em',
            textTransform: 'uppercase', marginTop: 2 }}>boxbox.app</div>
        </div>
      </div>
    </div>
  );
}

// ── Flag code mapping ─────────────────────────────────────────────────────────
const DRIVER_FLAG_CODES = {
  VER: 'nl', NOR: 'gb', LEC: 'mc', SAI: 'es', HAM: 'gb',
  RUS: 'gb', PIA: 'au', ALO: 'es', STR: 'ca', GAS: 'fr',
  OCO: 'fr', ALB: 'th', TSU: 'jp', RIC: 'au',
  MAG: 'dk', HUL: 'de', BOT: 'fi', ZHO: 'cn', LAW: 'nz',
  BEA: 'au', DOO: 'au', ANT: 'gb', HAD: 'fr', BOR: 'fr',
  COL: 'ar',
};
