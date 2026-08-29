import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Flag, Zap, Timer, Calendar, TrendingUp, ChevronDown, Users, Search } from 'lucide-react';
import { fetchCareerStats, fetchCareerComparison } from '../services/api';
import { CAREER_DRIVERS, getCareerMoment } from '../utils/careerDrivers';
import { getDriverImage } from '../utils/driverImages';
import { getTeamColor } from '../utils/teamColors';
import AILoadingBlock from '../components/AILoadingBlock';

// ── Team color map for historical teams ──
const TEAM_COLOR_MAP = {
  'red_bull': '#3671C6',
  'mclaren': '#FF8000',
  'mercedes': '#27F4D2',
  'ferrari': '#E8002D',
  'alpine': '#0093CC',
  'renault': '#FFF500',
  'aston_martin': '#229971',
  'racing_point': '#F596C8',
  'force_india': '#F596C8',
  'williams': '#64C4FF',
  'haas': '#B6BABD',
  'alphatauri': '#4E7C9B',
  'toro_rosso': '#4E7C9B',
  'rb': '#6692FF',
  'sauber': '#52E252',
  'alfa': '#C92D4B',
  'benetton': '#00FF00',
  'brawn': '#C8FF00',
  'lotus_f1': '#FFB800',
  'jordan': '#EBC94D',
  'minardi': '#000000',
};

function getHistoricalTeamColor(teamId) {
  if (!teamId) return '#666';
  const key = teamId.toLowerCase().replace(/\s+/g, '_');
  return TEAM_COLOR_MAP[key] || '#666';
}

// ── Animated counter hook ──
function useAnimatedCounter(target, duration = 1500, start = false) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (!start || !target) return;
    let startTime;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setValue(Math.floor(progress * target));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => ref.current && cancelAnimationFrame(ref.current);
  }, [target, duration, start]);

  return value;
}

// ── Skeleton Loader ──
function HeroSkeleton() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 20,
      padding: '2rem',
      display: 'flex',
      gap: '2rem',
      minHeight: 400,
      animation: 'pulse 2s ease-in-out infinite',
    }}>
      <div style={{ width: '35%', background: 'rgba(255,255,255,0.05)', borderRadius: 16, minHeight: 350 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: 120, height: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }} />
        <div style={{ width: '60%', height: 48, background: 'rgba(255,255,255,0.05)', borderRadius: 12 }} />
        <div style={{ width: 200, height: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ height: 80, background: 'rgba(255,255,255,0.05)', borderRadius: 12 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', padding: '2rem 0' }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{
          width: '60%', height: 120,
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)',
          animation: 'pulse 2s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════

export default function DriverCareer() {
  const [selectedDriver, setSelectedDriver] = useState(CAREER_DRIVERS[0]);
  const [careerData, setCareerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [longLoading, setLongLoading] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [heroAnimated, setHeroAnimated] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [goatToast, setGoatToast] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch career data — Jolpica pagination can take 10-20s for Hamilton (383 races)
  useEffect(() => {
    let cancelled = false;
    let longTimer = null;
    async function load() {
      setLoading(true);
      setError(null);
      setLongLoading(false);
      setHeroAnimated(false);
      longTimer = setTimeout(() => { if (!cancelled) setLongLoading(true) }, 5000);
      try {
        const data = await fetchCareerStats(selectedDriver.id);
        if (!cancelled) {
          clearTimeout(longTimer);
          setLongLoading(false);
          if (!data || !data.totals) throw new Error('No career data returned');
          setCareerData(data);
          setTimeout(() => setHeroAnimated(true), 300);
        }
      } catch (err) {
        if (!cancelled) {
          clearTimeout(longTimer);
          setLongLoading(false);
          const msg = err.message || 'Failed to load career data';
          // Map timeout / 502 to user-friendly
          if (msg.includes('TIMEOUT') || msg.includes('timeout') || msg.includes('502') || msg.includes('Network')) {
            setError('Career data is taking longer than expected — Jolpica is slow or rate-limited. Please retry in a moment. (No data was fabricated.)');
          } else {
            setError(msg);
          }
        }
      } finally {
        if (!cancelled) { clearTimeout(longTimer); setLoading(false); }
      }
    }
    load();
    return () => { cancelled = true; clearTimeout(longTimer); };
  }, [selectedDriver.id, retryKey]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const currentDrivers = CAREER_DRIVERS.filter(d => d.group === 'current');
  const legendDrivers = CAREER_DRIVERS.filter(d => d.group === 'legend');

  const filteredCurrent = currentDrivers.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredLegends = legendDrivers.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ padding: '6rem 1.5rem 4rem', maxWidth: 1200, margin: '0 auto' }}
    >
      {/* ── Page Header — removed duplicate, only one "Career Timeline" in the timeline section ── */}
      <div style={{ marginBottom: '2rem' }}>
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ color: '#e10600', fontFamily: 'Space Grotesk', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}
        >
          Historical Trajectory
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ fontFamily: 'Space Grotesk', fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.02em' }}
        >
          Driver Legacy
        </motion.h1>
      </div>

      {/* ── Driver Selector ── */}
      <div style={{ marginBottom: '2rem', position: 'relative', maxWidth: 400 }} ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${selectedDriver.teamColor}40`,
            borderRadius: 12,
            color: 'white',
            fontFamily: 'Space Grotesk',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedDriver.teamColor }} />
            {selectedDriver.name}
          </div>
          <ChevronDown size={18} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
        </button>

        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                marginTop: 4,
                background: 'rgba(16, 16, 16, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                overflow: 'hidden',
                zIndex: 100,
                maxHeight: 400,
              }}
            >
              {/* Search */}
              <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '6px 10px' }}>
                  <Search size={14} color="#666" />
                  <input
                    type="text"
                    placeholder="Search drivers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    style={{
                      background: 'transparent', border: 'none', outline: 'none',
                      color: 'white', fontFamily: 'Space Grotesk', fontSize: 13, width: '100%',
                    }}
                  />
                </div>
              </div>

              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {/* Current Grid */}
                {filteredCurrent.length > 0 && (
                  <>
                    <div style={{ padding: '8px 14px 4px', fontSize: 10, color: '#666', fontFamily: 'Space Grotesk', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                      Current Grid
                    </div>
                    {filteredCurrent.map(d => (
                      <DriverOption key={d.id} driver={d} selected={selectedDriver.id === d.id} onClick={() => {
                        setSelectedDriver(d);
                        setDropdownOpen(false);
                        setSearchQuery('');
                      }} />
                    ))}
                  </>
                )}
                {/* Legends */}
                {filteredLegends.length > 0 && (
                  <>
                    <div style={{ padding: '12px 14px 4px', fontSize: 10, color: '#666', fontFamily: 'Space Grotesk', letterSpacing: '0.15em', textTransform: 'uppercase', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      Legends
                    </div>
                    {filteredLegends.map(d => (
                      <DriverOption key={d.id} driver={d} selected={selectedDriver.id === d.id} onClick={() => {
                        setSelectedDriver(d);
                        setDropdownOpen(false);
                        setSearchQuery('');
                      }} />
                    ))}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Error State ── */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            background: 'rgba(225, 6, 0, 0.1)',
            border: '1px solid rgba(225, 6, 0, 0.3)',
            borderRadius: 16, padding: '2rem', textAlign: 'center',
          }}
        >
          <p style={{ color: '#e10600', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 18 }}>
            Career data unavailable
          </p>
          <p style={{ color: '#888', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>{error}</p>
          <p style={{ color: '#666', fontSize: 12, marginTop: 6 }}>The rest of BoxBox remains usable. Try another driver or retry — we won't hammer the API.</p>
          <button
            onClick={() => { setRetryKey(k=>k+1) }}
            style={{
              marginTop: 16, padding: '10px 28px',
              background: '#e10600', color: 'white', border: 'none',
              borderRadius: 100, fontFamily: 'Space Grotesk', fontWeight: 700,
              cursor: 'pointer', fontSize: 14,
            }}
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* ── Loading Skeleton ── */}
      {loading && !error && (
        <>
          <HeroSkeleton />
          {longLoading && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ textAlign:'center', marginTop:16, color:'#888', fontFamily:'Space Grotesk', fontSize:12, lineHeight:1.5 }}>
              <p>Fetching full career history — {selectedDriver.name} has many seasons, this can take up to 20 seconds.</p>
              <p style={{ color:'#666', fontSize:11, marginTop:4 }}>Powered by Jolpica (Ergast mirror) — no data is fabricated. Please wait, or try another driver.</p>
            </motion.div>
          )}
        </>
      )}

      {/* ── Hero Section ── */}
      {careerData && !loading && !error && (
        <HeroSection
          data={careerData}
          driver={selectedDriver}
          animated={heroAnimated}
          onGoatToast={() => {
            setGoatToast(true);
            setTimeout(() => setGoatToast(false), 3500);
          }}
        />
      )}

      {/* ── Timeline ── */}
      {loading && !error && <div style={{ marginTop: '3rem' }}><TimelineSkeleton /></div>}
      {careerData && !loading && !error && (
        <TimelineSection data={careerData} />
      )}

      {/* Compare button */}
      {careerData && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{ textAlign: 'center', margin: '3rem 0 2rem' }}
        >
          <button
            onClick={() => setCompareOpen(true)}
            style={{
              padding: '14px 36px',
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 100,
              color: 'white',
              fontFamily: 'Space Grotesk',
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              transition: 'all 0.3s',
            }}
            onMouseEnter={e => {
              e.target.style.background = 'rgba(225, 6, 0, 0.15)';
              e.target.style.borderColor = '#e10600';
            }}
            onMouseLeave={e => {
              e.target.style.background = 'rgba(255,255,255,0.03)';
              e.target.style.borderColor = 'rgba(255,255,255,0.1)';
            }}
          >
            <span style={{ marginRight: 8 }}>⚔️</span> Compare Careers
          </button>
        </motion.div>
      )}

      {/* Compare Modal placeholder */}
      <AnimatePresence>
        {compareOpen && (
          <CompareModal
            currentDriver={selectedDriver}
            currentData={careerData}
            onClose={() => setCompareOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* GOAT Toast */}
      <AnimatePresence>
        {goatToast && (
          <motion.div
            initial={{ opacity: 0, y: 60, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            style={{
              position: 'fixed', bottom: 100, right: 20, zIndex: 20000,
              background: 'rgba(20, 18, 8, 0.95)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(252, 180, 50, 0.4)',
              borderRadius: 16, padding: '14px 20px',
              maxWidth: 320,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(252, 180, 50, 0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>🐐</span>
              <span style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800, color: '#fcd362', letterSpacing: '0.05em' }}>
                The Greatest Of All Time
              </span>
            </div>
            <p style={{ fontFamily: 'Space Grotesk', fontSize: 12, color: '#ccc', margin: 0, lineHeight: 1.5 }}>
              7 Championships. 105 Wins. 107 Poles.<br />
              <span style={{ color: '#fcd362' }}>The data doesn't lie.</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes goldGlow {
          0%, 100% { box-shadow: 0 0 12px rgba(252, 211, 98, 0.3); }
          50% { box-shadow: 0 0 24px rgba(252, 211, 98, 0.6); }
        }
      `}</style>
    </motion.div>
  );
}


// ══════════════════════════════════════════════
//  DRIVER OPTION (Dropdown item)
// ══════════════════════════════════════════════

function DriverOption({ driver, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        background: selected ? 'rgba(225, 6, 0, 0.1)' : 'transparent',
        border: 'none',
        color: selected ? '#e10600' : 'white',
        fontFamily: 'Space Grotesk',
        fontSize: 14,
        fontWeight: selected ? 700 : 500,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.2s',
      }}
      onMouseEnter={e => { if (!selected) e.target.style.background = 'rgba(255,255,255,0.05)'; }}
      onMouseLeave={e => { if (!selected) e.target.style.background = 'transparent'; }}
    >
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: driver.teamColor,
        flexShrink: 0,
      }} />
      <span>{driver.name}</span>
      {driver.group === 'legend' && (
        <span style={{ fontSize: 10, color: '#666', marginLeft: 'auto' }}>LEGEND</span>
      )}
    </button>
  );
}


// ══════════════════════════════════════════════
//  HERO SECTION
// ══════════════════════════════════════════════

function HeroSection({ data, driver, animated, onGoatToast }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const totals = data.totals;
  const driverInfo = data.driver_info;
  const teamHistory = data.team_history || [];
  const teamColor = getTeamColor(driver.team) || driver.teamColor;
  const driverImage = getDriverImage(driver.code);

  const championships = useAnimatedCounter(totals.championships, 1200, animated);
  const wins = useAnimatedCounter(totals.wins, 1500, animated);
  const podiums = useAnimatedCounter(totals.podiums, 1500, animated);
  const poles = useAnimatedCounter(totals.poles, 1400, animated);
  const fastestLaps = useAnimatedCounter(totals.fastest_laps, 1400, animated);
  const seasons = useAnimatedCounter(totals.seasons_count, 1000, animated);

  const isHamilton = data.driver_id === 'hamilton';

  const statCards = [
    { label: 'Championships', value: animated ? championships : '—', icon: <Trophy size={16} />, color: '#fcd362' },
    { label: 'Race Wins', value: animated ? wins : '—', icon: <Flag size={16} />, color: '#fff' },
    { label: 'Podiums', value: animated ? podiums : '—', icon: <TrendingUp size={16} />, color: '#fff' },
    { label: 'Pole Positions', value: animated ? poles : '—', icon: <Zap size={16} />, color: '#00D2BE' },
    { label: 'Fastest Laps', value: animated ? fastestLaps : '—', icon: <Timer size={16} />, color: '#7C3AED' },
    { label: 'Seasons', value: animated ? seasons : '—', icon: <Calendar size={16} />, color: '#888' },
  ];

  // Determine active years
  const sortedYears = Object.keys(data.seasons).sort();
  const firstYear = sortedYears[0];
  const lastYear = sortedYears[sortedYears.length - 1];
  const activeYears = `${firstYear} — ${parseInt(lastYear) >= 2025 ? 'PRESENT' : lastYear}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Team color gradient glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '100%',
        background: `radial-gradient(ellipse at 20% 20%, ${teamColor}15 0%, transparent 60%)`,
        pointerEvents: 'none',
      }} />

      <div style={{
        display: 'flex',
        flexDirection: 'row',
        position: 'relative',
      }}
        className="hero-content"
      >
        {/* Left — Driver Photo */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          style={{
            width: '35%',
            minHeight: 380,
            position: 'relative',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
          className="hero-photo-section"
        >
          {/* Team color gradient behind photo */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%',
            background: `linear-gradient(to top, ${teamColor}30, transparent 70%)`,
          }} />

          {driverImage ? (
            <img
              src={driverImage}
              alt={driver.name}
              loading="lazy"
              decoding="async"
              style={{
                width: '85%',
                maxHeight: 340,
                objectFit: 'contain',
                objectPosition: 'bottom',
                position: 'relative',
                zIndex: 2,
                filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.5))',
              }}
              crossOrigin="anonymous"
            />
          ) : (
            <div style={{
              width: 200, height: 200,
              borderRadius: '50%',
              background: `${teamColor}30`,
              border: `2px solid ${teamColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 64, fontFamily: 'Space Grotesk', fontWeight: 800,
              color: teamColor, position: 'relative', zIndex: 2,
            }}>
              {driver.code}
            </div>
          )}

          {/* GOAT Protocol easter egg for Hamilton — clickable! */}
          {isHamilton && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              onClick={onGoatToast}
              style={{
                position: 'absolute', bottom: 16, left: 16, zIndex: 3,
                background: 'rgba(0, 200, 83, 0.15)',
                border: '1px solid rgba(0, 200, 83, 0.4)',
                borderRadius: 8, padding: '4px 10px',
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              {...(!isMobile && { whileHover: { scale: 1.05, background: 'rgba(0, 200, 83, 0.25)' } })}
              whileTap={{ scale: 0.95 }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00c853', animation: 'pulse 2s infinite' }} />
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#00c853', letterSpacing: '0.05em' }}>
                GOAT_PROTOCOL_ENABLED
              </span>
            </motion.div>
          )}
        </motion.div>

        {/* Right — Info & Stats */}
        <div style={{ flex: 1, padding: '2rem 2rem 2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Nationality */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <img
              src={`https://flagcdn.com/24x18/${getNationalityFlag(driverInfo.nationality)}.png`}
              alt={driverInfo.nationality}
              loading="lazy"
              decoding="async"
              style={{ width: 20, height: 15, borderRadius: 2 }}
              onError={(e) => e.target.style.display = 'none'}
            />
            <span style={{ fontFamily: 'Space Grotesk', fontSize: 12, color: '#888', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              {driverInfo.nationality}
            </span>
          </motion.div>

          {/* Name */}
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            style={{
              fontFamily: 'Space Grotesk', fontSize: 'clamp(32px, 4vw, 56px)',
              fontWeight: 800, color: 'white', margin: 0,
              letterSpacing: '-0.03em', lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            {driverInfo.givenName}<br />{driverInfo.familyName}
          </motion.h2>

          {/* Team + Years */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
          >
            <span style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 700, color: teamColor, textTransform: 'uppercase' }}>
              {driver.team}
            </span>
            <span style={{ color: '#555', fontSize: 14, fontFamily: 'Space Grotesk' }}>{activeYears}</span>
          </motion.div>

          {/* Stat Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            marginTop: 8,
          }} className="stat-grid">
            {statCards.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.08 }}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: stat.color, opacity: 0.7 }}>{stat.icon}</span>
                  <span style={{ fontFamily: 'Space Grotesk', fontSize: 10, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {stat.label}
                  </span>
                </div>
                <span style={{
                  fontFamily: 'Space Grotesk', fontSize: 'clamp(26px, 3vw, 38px)',
                  fontWeight: 800, color: stat.color,
                  lineHeight: 1,
                }}>
                  {stat.value}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Team History Pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}
          >
            {teamHistory.map((th, i) => {
              const tc = getHistoricalTeamColor(th.teamId);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.1 + i * 0.1 }}
                  style={{
                    background: `${tc}20`,
                    border: `1px solid ${tc}60`,
                    borderRadius: 100,
                    padding: '4px 12px',
                    fontFamily: 'Space Grotesk',
                    fontSize: 11,
                    color: tc,
                    fontWeight: 600,
                    letterSpacing: '0.03em',
                    cursor: 'default',
                    transition: 'background 0.2s',
                  }}
                  {...(!isMobile && { whileHover: { background: `${tc}40` } })}
                >
                  {th.team} {th.startYear}–{th.endYear.slice(-2)}
                </motion.div>
              );
            })}

            {/* Peak Season Badge */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.4 }}
              style={{
                background: 'rgba(252, 211, 98, 0.12)',
                border: '1px solid rgba(252, 211, 98, 0.4)',
                borderRadius: 100,
                padding: '4px 12px',
                fontFamily: 'Space Grotesk',
                fontSize: 11,
                color: '#fcd362',
                fontWeight: 700,
                letterSpacing: '0.05em',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span>🔥</span> PEAK: {totals.peak_season} SEASON
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Responsive style */}
      <style>{`
        @media (max-width: 768px) {
          .hero-content {
            flex-direction: column !important;
          }
          .hero-photo-section {
            width: 100% !important;
            min-height: 250px !important;
          }
          .stat-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </motion.div>
  );
}


// ══════════════════════════════════════════════
//  TIMELINE SECTION
// ══════════════════════════════════════════════

function TimelineSection({ data }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const seasons = data.seasons;
  const sortedYears = Object.keys(seasons).sort((a, b) => b - a); // newest first

  return (
    <div style={{ marginTop: '3rem', position: 'relative' }}>
      {/* Section Header */}
      <motion.div
        {...(isMobile
          ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
          : { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true } })}
        style={{ textAlign: 'center', marginBottom: '2.5rem' }}
      >
        <p style={{ color: '#e10600', fontFamily: 'Space Grotesk', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
          Season by Season
        </p>
        <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: 'white', margin: 0 }}>
          Career Timeline
        </h2>
      </motion.div>

      {/* Timeline Line */}
      <div style={{ position: 'relative', paddingBottom: '2rem' }}>
        {/* Center vertical line */}
        <div style={{
          position: 'absolute',
          left: '50%',
          width: 2,
          top: 0,
          bottom: 0,
          background: 'linear-gradient(to bottom, #e10600, rgba(225,6,0,0.2))',
          transform: 'translateX(-50%)',
        }} className="timeline-line" />

        {/* Season cards */}
        {sortedYears.map((year, index) => {
          const season = seasons[year];
          const isChampion = season.championship_pos === 1;
          const isRunnerUp = season.championship_pos === 2;
          const isLeft = index % 2 === 0;
          const teamColor = getHistoricalTeamColor(season.teamId);
          const moment = getCareerMoment(data.driver_id, year, season.team);
          const isMuted = season.championship_pos && season.championship_pos > 15;

          return (
            <motion.div
              key={year}
              {...(isMobile
                ? { initial: { opacity: 1, x: 0 }, animate: { opacity: 1, x: 0 } }
                : {
                    initial: { opacity: 0, x: isLeft ? -30 : 30 },
                    whileInView: { opacity: 1, x: 0 },
                    viewport: { once: true, margin: '-50px' }
                  })}
              transition={{ duration: isMobile ? 0.2 : 0.5, delay: isMobile ? 0 : 0.05 }}
              style={{
                display: 'flex',
                justifyContent: isLeft ? 'flex-end' : 'flex-start',
                paddingLeft: isLeft ? 0 : '52%',
                paddingRight: isLeft ? '52%' : 0,
                marginBottom: '1.5rem',
                position: 'relative',
              }}
              className="timeline-card-wrapper"
            >
              {/* Year badge on the line */}
              <div style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                top: 16,
                width: 44, height: 44,
                borderRadius: '50%',
                background: isChampion ? '#fcd362' : 'rgba(20,20,20,0.9)',
                border: `2px solid ${isChampion ? '#fcd362' : teamColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 800,
                color: isChampion ? '#000' : teamColor,
                zIndex: 5,
              }} className="timeline-year-badge">
                {year}
              </div>

              {/* Card */}
              <div style={{
                width: '100%',
                background: isChampion
                  ? 'rgba(252, 211, 98, 0.06)'
                  : 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(12px)',
                border: isChampion
                  ? '1px solid rgba(252, 211, 98, 0.35)'
                  : '1px solid rgba(255,255,255,0.08)',
                borderLeft: `4px solid ${teamColor}`,
                borderRadius: 16,
                padding: '16px 20px',
                opacity: isMuted ? 0.6 : 1,
                animation: isChampion ? 'goldGlow 3s ease-in-out infinite' : 'none',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Champion Banner */}
                {isChampion && (
                  <div style={{
                    position: 'absolute', top: 0, right: 0,
                    background: 'linear-gradient(135deg, transparent 50%, #fcd362 50%)',
                    width: 50, height: 50,
                  }}>
                    <span style={{ position: 'absolute', top: 8, right: 6, fontSize: 14 }}>👑</span>
                  </div>
                )}

                {/* Team + Championship pos */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{
                    fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 700,
                    color: teamColor, textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    {season.team}
                  </span>
                  {isChampion && (
                    <span style={{
                      fontFamily: 'Space Grotesk', fontSize: 10, fontWeight: 800,
                      color: '#fcd362', letterSpacing: '0.1em',
                      background: 'rgba(252, 211, 98, 0.15)',
                      padding: '2px 8px', borderRadius: 100,
                    }}>
                      🏆 WORLD CHAMPION
                    </span>
                  )}
                </div>

                {/* Position badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{
                    fontFamily: 'Space Grotesk', fontWeight: 800,
                    fontSize: isChampion ? 28 : 22,
                    color: isChampion ? '#fcd362' : isRunnerUp ? '#C0C0C0' : '#fff',
                    lineHeight: 1,
                  }}>
                    P{season.championship_pos || '—'}
                  </div>

                  {/* Inline stats */}
                  <div style={{ display: 'flex', gap: 14, fontFamily: 'Space Grotesk', fontSize: 12 }}>
                    <span style={{ color: '#aaa' }}>W <strong style={{ color: '#fff' }}>{season.wins}</strong></span>
                    <span style={{ color: '#aaa' }}>POD <strong style={{ color: '#fff' }}>{season.podiums}</strong></span>
                    <span style={{ color: '#aaa' }}>PTS <strong style={{ color: '#fff' }}>{season.points}</strong></span>
                  </div>
                </div>

                {/* Mini Bar Chart — wins visualization */}
                {season.wins > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-end', gap: 2,
                    height: 30, marginBottom: 8,
                  }}>
                    {season.win_positions.slice(-Math.min(20, season.win_positions.length)).map((pos, i) => (
                      <div key={i} style={{
                        flex: 1,
                        maxWidth: 8,
                        height: `${Math.max(4, (1 - (pos - 1) / 20) * 100)}%`,
                        background: pos === 1 ? teamColor : `${teamColor}40`,
                        borderRadius: 2,
                        transition: 'height 0.3s',
                      }} />
                    ))}
                  </div>
                )}

                {/* Key moment */}
                {moment && (
                  <p style={{
                    fontFamily: 'Space Grotesk', fontSize: 12, fontStyle: 'italic',
                    color: '#888', margin: 0, marginTop: 4, lineHeight: 1.4,
                  }}>
                    {moment}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Career Summary Bar */}
      <motion.div
        {...(isMobile
          ? { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 } }
          : { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true } })}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginTop: '1rem',
        }}
      >
        {[
          { label: `${data.totals.total_races} Races`, value: `${data.totals.wins} WINS`, color: '#fff' },
          { label: 'Podiums', value: data.totals.podiums, color: '#27F4D2' },
          { label: 'Pole Positions', value: data.totals.poles, color: '#7C3AED' },
        ].map((item, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: '20px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 10, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
              {item.label}
            </div>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 32, fontWeight: 800, color: item.color }}>
              {item.value}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Responsive timeline */}
      <style>{`
        @media (max-width: 768px) {
          .timeline-line { left: 24px !important; }
          .timeline-card-wrapper {
            padding-left: 56px !important;
            padding-right: 0 !important;
            justify-content: flex-start !important;
          }
          .timeline-year-badge {
            left: 24px !important;
            transform: translateX(-50%) !important;
            width: 36px !important;
            height: 36px !important;
            font-size: 9px !important;
          }
        }
      `}</style>
    </div>
  );
}


// ══════════════════════════════════════════════
//  COMPARE MODAL (Step 5 — full implementation)
// ══════════════════════════════════════════════

function CompareModal({ currentDriver, currentData, onClose }) {
  const [compareDriver, setCompareDriver] = useState(null);
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiVerdict, setAiVerdict] = useState('');
  const [verdictLoading, setVerdictLoading] = useState(false);

  const otherDrivers = CAREER_DRIVERS.filter(d => d.id !== currentDriver.id);

  async function loadCompareData(driver) {
    setCompareDriver(driver);
    setLoading(true);
    setAiVerdict('');
    try {
      const data = await fetchCareerStats(driver.id);
      setCompareData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // AI Verdict
  const getVerdict = useCallback(async () => {
    if (!compareDriver || !currentDriver) return;
    setVerdictLoading(true);
    try {
      const result = await fetchCareerComparison(currentDriver.id, compareDriver.id);
      setAiVerdict(result.verdict || 'Analysis unavailable');
    } catch {
      setAiVerdict('AI verdict unavailable at this time.');
    } finally {
      setVerdictLoading(false);
    }
  }, [compareDriver, currentDriver]);

  useEffect(() => {
    if (compareData && currentData) {
      void getVerdict();
    }
  }, [compareData, currentData, getVerdict]);

  const statRows = currentData && compareData ? [
    { label: 'Championships', a: currentData.totals.championships, b: compareData.totals.championships },
    { label: 'Wins', a: currentData.totals.wins, b: compareData.totals.wins },
    { label: 'Podiums', a: currentData.totals.podiums, b: compareData.totals.podiums },
    { label: 'Pole Positions', a: currentData.totals.poles, b: compareData.totals.poles },
    { label: 'Fastest Laps', a: currentData.totals.fastest_laps, b: compareData.totals.fastest_laps },
    { label: 'Seasons', a: currentData.totals.seasons_count, b: compareData.totals.seasons_count },
    { label: 'Win Rate %', a: currentData.totals.win_rate, b: compareData.totals.win_rate },
  ] : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="compare-modal-inner"
        style={{
          background: 'rgba(16, 16, 16, 0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          width: '100%',
          maxWidth: 600,
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '2rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⚔️</span>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800, color: 'white', margin: 0, textTransform: 'uppercase' }}>
              Performance Comparison
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 24, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Drivers VS section */}
        <div className="compare-drivers-row" style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'center' }}>
          <DriverAvatar driver={currentDriver} data={currentData} />
          <span className="compare-vs-label" style={{ fontFamily: 'Space Grotesk', fontSize: 16, color: '#555', fontWeight: 700 }}>VS</span>
          {compareDriver && compareData ? (
            <DriverAvatar driver={compareDriver} data={compareData} />
          ) : (
            <div style={{ textAlign: 'center' }}>
              <motion.div
                className="driver-avatar-card"
                animate={{ borderColor: ['rgba(255,255,255,0.15)', 'rgba(225,6,0,0.3)', 'rgba(255,255,255,0.15)'] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  width: 80, height: 80, borderRadius: 12,
                  border: '2px dashed rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.03)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 2,
                }}
              >
                <span style={{ fontSize: 20, color: '#444', lineHeight: 1 }}>?</span>
                <span style={{ fontFamily: 'Space Grotesk', fontSize: 7, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Choose<br />Below
                </span>
              </motion.div>
              <p className="driver-avatar-name" style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 700, color: '#444', margin: '6px 0 0', textTransform: 'uppercase' }}>
                Driver 2
              </p>
              <p className="driver-avatar-code" style={{ fontFamily: 'Space Grotesk', fontSize: 10, color: '#333', margin: 0 }}>
                — | #—
              </p>
            </div>
          )}
        </div>

        {/* Inline Driver Picker Grid — lives in modal body flow */}
        {!compareData && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 14,
              padding: '16px',
              marginBottom: '1rem',
            }}
          >
            <p style={{
              fontFamily: 'Space Grotesk', fontSize: 11, color: '#888',
              textTransform: 'uppercase', letterSpacing: '0.12em',
              margin: '0 0 12px', textAlign: 'center', fontWeight: 600,
            }}>
              👇 Select a driver to compare
            </p>

            {/* Current Grid */}
            <p style={{
              fontFamily: 'Space Grotesk', fontSize: 10, color: '#555',
              textTransform: 'uppercase', letterSpacing: '0.15em',
              margin: '0 0 8px', fontWeight: 700,
            }}>
              Current Grid
            </p>
            <div className="compare-driver-grid" style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 10, marginBottom: 16,
            }}>
              {otherDrivers.filter(d => d.group === 'current').map((driver, i) => (
                <DriverChipButton key={driver.id} driver={driver} delay={i * 0.03} onSelect={loadCompareData} />
              ))}
            </div>

            {/* Legends */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: 12 }} />
            <p style={{
              fontFamily: 'Space Grotesk', fontSize: 10, color: '#555',
              textTransform: 'uppercase', letterSpacing: '0.15em',
              margin: '0 0 8px', fontWeight: 700,
            }}>
              Legends
            </p>
            <div className="compare-driver-grid" style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 10,
            }}>
              {otherDrivers.filter(d => d.group === 'legend').map((driver, i) => (
                <DriverChipButton key={driver.id} driver={driver} delay={0.15 + i * 0.03} onSelect={loadCompareData} isLegend />
              ))}
            </div>
          </motion.div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontFamily: 'Space Grotesk' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#e10600', borderRadius: '50%', margin: '0 auto 12px' }}
            />
            Loading career data...
          </div>
        )}

        {/* Stat rows */}
        {compareData && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {statRows.map((row, i) => {
              const aWins = row.a > row.b;
              const bWins = row.b > row.a;
              return (
                <motion.div
                  key={row.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    padding: '10px 16px',
                    borderRadius: 8,
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  }}
                >
                  <span style={{
                    fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800,
                    color: aWins ? '#fcd362' : '#fff',
                    textAlign: 'right',
                  }}>
                    {row.a}
                  </span>
                  <span style={{
                    fontFamily: 'Space Grotesk', fontSize: 11,
                    color: '#888', textTransform: 'uppercase',
                    letterSpacing: '0.1em', textAlign: 'center',
                    padding: '0 16px', minWidth: 100,
                  }}>
                    {row.label}
                  </span>
                  <span style={{
                    fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800,
                    color: bWins ? '#fcd362' : '#fff',
                    textAlign: 'left',
                  }}>
                    {row.b}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* AI Verdict */}
        {(aiVerdict || verdictLoading) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{
              marginTop: '1.5rem',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: '14px 18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>🤖</span>
              <span style={{ fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 700, color: '#e10600', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                AI Verdict
              </span>
            </div>
            <p style={{
              fontFamily: 'Space Grotesk', fontSize: 13, color: '#ccc',
              margin: 0, lineHeight: 1.6, fontStyle: 'italic',
            }}>
              {verdictLoading ? null : aiVerdict}
            </p>
            {verdictLoading && (
              <AILoadingBlock
                compact
                eyebrow="AI comparison"
                message="Comparing peak seasons, totals, and legacy weight."
                detail="Your verdict will appear here as soon as the model finishes."
                lines={3}
              />
            )}
          </motion.div>
        )}

        {/* Change comparison */}
        {compareData && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button
              onClick={() => { setCompareDriver(null); setCompareData(null); setAiVerdict(''); }}
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                color: '#888', fontFamily: 'Space Grotesk', fontSize: 12,
                padding: '6px 16px', borderRadius: 100, cursor: 'pointer',
              }}
            >
              Change Driver
            </button>
          </div>
        )}

        {/* Responsive styles for compare modal */}
        <style>{`
          @media (max-width: 600px) {
            .compare-driver-grid {
              grid-template-columns: repeat(3, 1fr) !important;
              gap: 8px !important;
            }
            .chip-photo {
              width: 38px !important;
              height: 38px !important;
            }
          }
          @media (max-width: 480px) {
            .compare-modal-inner {
              padding: 1.25rem !important;
              max-height: 85vh !important;
            }
            .compare-drivers-row {
              gap: 0.75rem !important;
            }
            .compare-vs-label {
              font-size: 13px !important;
            }
            .driver-avatar-card {
              width: 68px !important;
              height: 68px !important;
            }
            .driver-avatar-name {
              font-size: 11px !important;
            }
            .driver-avatar-code {
              font-size: 9px !important;
            }
            .compare-driver-grid {
              grid-template-columns: repeat(3, 1fr) !important;
              gap: 6px !important;
            }
            .chip-photo {
              width: 34px !important;
              height: 34px !important;
            }
            .chip-name {
              font-size: 9px !important;
            }
            .chip-code {
              font-size: 7px !important;
            }
          }
        `}</style>
      </motion.div>
    </motion.div>
  );
}


// ── Legend Monogram Fallback — premium look for drivers with no photo ──
function LegendMonogram({ code, teamColor }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: `linear-gradient(135deg, ${teamColor}30, ${teamColor}10)`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: 4,
        background: 'linear-gradient(135deg, #FFD700, #FFA500)',
        color: '#000', fontSize: 6, fontWeight: 800,
        padding: '1px 4px', borderRadius: 3,
        letterSpacing: '0.1em', fontFamily: 'Space Grotesk',
      }}>LEGEND</div>
      <div style={{
        fontSize: 22, fontWeight: 900,
        color: 'transparent',
        WebkitTextStroke: `1.5px ${teamColor}`,
        letterSpacing: '0.05em', fontStyle: 'italic',
        fontFamily: 'Space Grotesk', lineHeight: 1,
        marginTop: 4,
      }}>{code}</div>
    </div>
  );
}


// ── Driver Chip Button for Picker Grid ──
function DriverChipButton({ driver, delay, onSelect, isLegend }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const img = getDriverImage(driver.code);
  const [imgError, setImgError] = useState(false);

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.2 }}
      {...(!isMobile && { whileHover: { scale: 1.08, y: -2 } })}
      whileTap={{ scale: 0.95 }}
      onClick={() => onSelect(driver)}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1.5px solid ${driver.teamColor}30`,
        borderRadius: 12,
        padding: '10px 6px 8px',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 6,
        transition: 'border-color 0.2s, background 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = driver.teamColor;
        e.currentTarget.style.background = `${driver.teamColor}12`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = `${driver.teamColor}30`;
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
      }}
    >
      <div className="chip-photo" style={{
        width: 44, height: 44, borderRadius: 10,
        overflow: 'hidden',
        border: `2px solid ${driver.teamColor}50`,
        background: `${driver.teamColor}10`,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
        {img && !imgError ? (
          <img
            src={img} alt={driver.name}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', objectFit: 'cover' }}
            onError={() => setImgError(true)}
          />
        ) : isLegend ? (
          <LegendMonogram code={driver.code} teamColor={driver.teamColor} />
        ) : (
          <span style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 800, color: driver.teamColor, paddingBottom: 8 }}>
            {driver.code}
          </span>
        )}
      </div>
      <span className="chip-name" style={{
        fontFamily: 'Space Grotesk', fontSize: 10, fontWeight: 600,
        color: '#ccc', textAlign: 'center', lineHeight: 1.2,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        maxWidth: '100%',
      }}>
        {driver.name.split(' ').pop()}
      </span>
      <span className="chip-code" style={{
        fontFamily: 'Space Grotesk', fontSize: 8, fontWeight: 700,
        color: driver.teamColor, background: `${driver.teamColor}15`,
        padding: '2px 6px', borderRadius: 4, letterSpacing: '0.05em',
      }}>
        {driver.code}
      </span>
    </motion.button>
  );
}


function DriverAvatar({ driver, data }) {
  const img = getDriverImage(driver.code);
  const tc = driver.teamColor;
  const [imgError, setImgError] = useState(false);
  const isLegend = driver.group === 'legend';

  return (
    <div style={{ textAlign: 'center' }}>
      <div className="driver-avatar-card" style={{
        width: 80, height: 80, borderRadius: 12,
        overflow: 'hidden',
        border: `2px solid ${tc}`,
        background: `${tc}15`,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
        {img && !imgError ? (
          <img
            src={img} alt={driver.name}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', objectFit: 'cover' }}
            onError={() => setImgError(true)}
          />
        ) : isLegend ? (
          <LegendMonogram code={driver.code} teamColor={tc} />
        ) : (
          <span style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 800, color: tc, paddingBottom: 16 }}>
            {driver.code}
          </span>
        )}
      </div>
      <p className="driver-avatar-name" style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 700, color: 'white', margin: '6px 0 0', textTransform: 'uppercase' }}>
        {data?.driver_info?.familyName || driver.name}
      </p>
      <p className="driver-avatar-code" style={{ fontFamily: 'Space Grotesk', fontSize: 10, color: tc, margin: 0 }}>
        {driver.code} | #{data?.driver_info?.permanentNumber || '—'}
      </p>
    </div>
  );
}


// ── Nationality → flag code helper ──
function getNationalityFlag(nationality) {
  const map = {
    'British': 'gb', 'Dutch': 'nl', 'Monégasque': 'mc', 'Spanish': 'es',
    'German': 'de', 'Finnish': 'fi', 'Mexican': 'mx', 'Australian': 'au',
    'Canadian': 'ca', 'French': 'fr', 'Japanese': 'jp', 'Thai': 'th',
    'Chinese': 'cn', 'Italian': 'it', 'Danish': 'dk', 'Brazilian': 'br',
    'American': 'us', 'Swiss': 'ch', 'Austrian': 'at', 'Argentine': 'ar',
    'Belgian': 'be', 'Polish': 'pl', 'New Zealander': 'nz', 'South African': 'za',
    'Colombian': 'co', 'Venezuelan': 've', 'Russian': 'ru', 'Swedish': 'se',
    'Indian': 'in', 'Indonesian': 'id', 'Malaysian': 'my',
  };
  return map[nationality] || 'un';
}
