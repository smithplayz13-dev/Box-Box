import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { getCurrentRaceStatus, formatCountdown } from '../utils/raceWeekendDetector';

/* ── Country flag URL helper ─────────────────────────── */
const flagUrl = (code) =>
  `https://flagcdn.com/w40/${code}.png`;

/* ── Session label map ────────────────────────────────── */
const SESSION_LABELS = {
  FP1: 'FREE PRACTICE 1',
  FP2: 'FREE PRACTICE 2',
  FP3: 'FREE PRACTICE 3',
  QUALIFYING: 'QUALIFYING',
  RACE: 'RACE',
};

/* ── Live Countdown Component ─────────────────────────── */
function LiveCountdown({ targetTime }) {
  const [cd, setCd] = useState(() => formatCountdown(targetTime));

  useEffect(() => {
    const iv = setInterval(() => {
      setCd(formatCountdown(targetTime));
    }, 1000);
    return () => clearInterval(iv);
  }, [targetTime]);

  if (!cd) return <span style={{ color: '#22c55e', fontWeight: 700 }}>STARTING NOW</span>;

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {[
        { val: pad(cd.hours), label: 'H' },
        { val: pad(cd.minutes), label: 'M' },
        { val: pad(cd.seconds), label: 'S' },
      ].map((u, i) => (
        <div key={u.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900,
              fontSize: 20,
              color: '#fff',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}>{u.val}</div>
            <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{u.label}</div>
          </div>
          {i < 2 && (
            <span style={{ color: '#444', fontWeight: 700, fontSize: 16, marginBottom: 10 }}>:</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Main Banner ──────────────────────────────────────── */
export default function RaceWeekendBanner() {
  const [status, setStatus] = useState(() => getCurrentRaceStatus());
  const [dismissed, setDismissed] = useState(false);

  // Refresh status every 30 s
  useEffect(() => {
    const iv = setInterval(() => setStatus(getCurrentRaceStatus()), 30_000);
    return () => clearInterval(iv);
  }, []);

  if (dismissed) return null;
  if (!status.isRaceWeekend && !status.isUpcoming) return null;

  /* ── Upcoming Banner (within 7 days) ──────────────── */
  if (status.isUpcoming) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{ overflow: 'hidden' }}
        >
          <div style={{
            background: 'linear-gradient(90deg, rgba(245,158,11,0.06) 0%, rgba(15,15,15,0.98) 50%)',
            borderBottom: '1px solid rgba(245,158,11,0.15)',
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 16 }}>🏁</span>
              <span style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 12,
                fontWeight: 700,
                color: '#F59E0B',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>COMING UP</span>
              <img
                src={flagUrl(status.race.country)}
                alt={status.race.country}
                loading="lazy"
                decoding="async"
                style={{ width: 22, height: 16, borderRadius: 2 }}
              />
              <span style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
              }}>{status.race.name}</span>
              <span style={{
                fontSize: 12,
                color: '#666',
              }}>— {status.daysUntil} day{status.daysUntil !== 1 ? 's' : ''} away</span>
            </div>
            <button
              onClick={() => setDismissed(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#555',
                cursor: 'pointer',
                fontSize: 16,
                padding: '2px 6px',
                lineHeight: 1,
              }}
            >✕</button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  /* ── Race Weekend Live Banner ─────────────────────── */
  const { race, currentSession, nextSession, isLive } = status;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.4 }}
        style={{ overflow: 'hidden' }}
      >
        <motion.div
          animate={{ borderLeftColor: ['#E10600', '#ff4444', '#E10600'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background: 'linear-gradient(90deg, rgba(225,6,0,0.06) 0%, #0f0f0f 40%)',
            borderLeft: '4px solid #E10600',
            borderBottom: '1px solid rgba(225,6,0,0.12)',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          {/* Left: Race info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Pulsing red dot */}
            <motion.div
              animate={{ opacity: [1, 0.3, 1], scale: [1, 1.2, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#E10600',
                boxShadow: '0 0 8px rgba(225,6,0,0.6)',
                flexShrink: 0,
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 10,
                fontWeight: 700,
                color: '#E10600',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}>RACE WEEKEND ACTIVE</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img
                  src={flagUrl(race.country)}
                  alt={race.country}
                  loading="lazy"
                  decoding="async"
                  style={{ width: 22, height: 16, borderRadius: 2 }}
                />
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#fff',
                }}>{race.name}</span>
                <span style={{
                  fontSize: 11,
                  color: '#555',
                }}>R{race.round}</span>
              </div>
            </div>
          </div>

          {/* Center: Session status */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}>
            {isLive ? (
              <>
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#E10600',
                    letterSpacing: '0.1em',
                  }}
                >
                  {currentSession === 'RACE' ? '🏎️ RACE DAY — LIVE' : `${SESSION_LABELS[currentSession]} LIVE`}
                </motion.span>
              </>
            ) : nextSession ? (
              <>
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#888',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}>NEXT: {SESSION_LABELS[nextSession.name]}</span>
                <LiveCountdown targetTime={nextSession.time} />
              </>
            ) : (
              <span style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 12,
                fontWeight: 700,
                color: '#22c55e',
                letterSpacing: '0.08em',
              }}>RACE COMPLETE ✓</span>
            )}
          </div>

          {/* Right: CTA + dismiss */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link
              to="/race-analysis"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 11,
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: 'rgba(225,6,0,0.12)',
                border: '1px solid rgba(225,6,0,0.3)',
                borderRadius: 100,
                padding: '6px 16px',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#E10600';
                e.target.style.borderColor = '#E10600';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(225,6,0,0.12)';
                e.target.style.borderColor = 'rgba(225,6,0,0.3)';
              }}
            >
              OPEN RACE ANALYSIS →
            </Link>
            <button
              onClick={() => setDismissed(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#555',
                cursor: 'pointer',
                fontSize: 16,
                padding: '2px 6px',
                lineHeight: 1,
              }}
              aria-label="Dismiss banner"
            >✕</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
