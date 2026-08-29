import { Link } from 'react-router-dom';
import { ArrowRight, Cloud, Timer, Flag, Zap, ChevronRight, Clock } from 'lucide-react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { useRaceCountdown } from '../utils/useRaceCountdown';
import { useState, useEffect } from 'react';
import PageTransition from '../components/PageTransition';
import { getDrivers } from '../services/api';
import { getTeamColor, DRIVER_DATA } from '../utils/teamColors';
import { getFlagUrl } from '../utils/flagHelper';
import DriverImage from '../components/DriverImage';
import { useMode } from '../context/ModeContext';
import ShareModal from '../components/ShareModal';
import EmailSignup from '../components/EmailSignup';

// ── Last Race Summary Card ──────────────────────────────────────────────────
const LAST_RACE = {
  name: 'Japanese Grand Prix',
  circuit: 'Suzuka Circuit',
  flag: '🇯🇵',
  date: '30 Mar 2026',
  round: 'Round 3 of 22',
  fastestLap: { driver: 'NOR', time: '1:31.204', team: 'McLaren' },
  podium: [
    { pos: 1, code: 'NOR', name: 'Lando Norris',     team: 'McLaren',         pts: '+25', flag: '🇬🇧' },
    { pos: 2, code: 'VER', name: 'Max Verstappen',   team: 'Red Bull Racing', pts: '+18', flag: '🇳🇱' },
    { pos: 3, code: 'LEC', name: 'Charles Leclerc',  team: 'Ferrari',         pts: '+15', flag: '🇲🇨' },
  ],
};

function LastRaceCard({ dur }) {
  const shouldReduceMotion = useReducedMotion();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [shareOpen, setShareOpen] = useState(false);

  const shareData = {
    raceName: LAST_RACE.name,
    round: LAST_RACE.round,
    year: '2026',
    p1: { code: LAST_RACE.podium[0].code, name: LAST_RACE.podium[0].name, team: LAST_RACE.podium[0].team, pts: LAST_RACE.podium[0].pts },
    p2: { code: LAST_RACE.podium[1].code, name: LAST_RACE.podium[1].name, team: LAST_RACE.podium[1].team, pts: LAST_RACE.podium[1].pts },
    p3: { code: LAST_RACE.podium[2].code, name: LAST_RACE.podium[2].name, team: LAST_RACE.podium[2].team, pts: LAST_RACE.podium[2].pts },
    fastestLap: { driver: LAST_RACE.fastestLap.driver, time: LAST_RACE.fastestLap.time },
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: shouldReduceMotion ? 0 : dur(0.55) }}
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
      }}
      className="overflow-hidden"
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-xl">{LAST_RACE.flag}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-['Space_Grotesk'] text-[10px] font-bold tracking-[0.2em] text-[#e10600] uppercase">Last Race</span>
              <span className="font-['Space_Grotesk'] text-[10px] text-[#444] uppercase tracking-widest">{LAST_RACE.round}</span>
            </div>
            <h3 className="font-['Space_Grotesk'] font-black text-white text-lg leading-tight">{LAST_RACE.name}</h3>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[#555]">
          <Clock size={11} />
          <span className="font-['Space_Grotesk'] text-[10px] uppercase tracking-widest">{LAST_RACE.date}</span>
        </div>
      </div>

      {/* Podium */}
      <div className="grid grid-cols-3 divide-x divide-white/5">
        {LAST_RACE.podium.map((p, i) => {
          const color = getTeamColor(p.team);
          const medals = ['🥇', '🥈', '🥉'];
          return (
            <motion.div
              key={p.pos}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.1, duration: shouldReduceMotion ? 0 : dur(0.4) }}
              className="px-4 py-5 flex flex-col gap-2 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{medals[i]}</span>
                <span className="font-['Space_Grotesk'] text-[10px] text-[#555] uppercase tracking-widest">P{p.pos}</span>
              </div>
              {/* team color bar */}
              <div className="h-0.5 w-8 rounded-full" style={{ background: color }} />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base leading-none">
                    <img src={getFlagUrl(p.code)} alt={p.code} loading="lazy" decoding="async" style={{ width: 24, height: 18, borderRadius: 2, display: 'inline-block' }} />
                  </span>
                  <span
                    className="font-['Space_Grotesk'] font-black text-base text-white"
                    style={{ textShadow: `0 0 20px ${color}60` }}
                  >{p.code}</span>
                </div>
                <div className="text-[10px] text-[#555] truncate mt-0.5">{p.team}</div>
              </div>
              <div
                className="font-['Space_Grotesk'] font-bold text-sm"
                style={{ color }}
              >{p.pts}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Fastest Lap + CTA */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-white/5 bg-[#0d0d0d]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#a855f7]" />
          <span className="font-['Space_Grotesk'] text-[10px] text-[#666] uppercase tracking-widest">Fastest Lap</span>
          <span className="font-['Space_Grotesk'] font-bold text-xs text-[#a855f7]">
            <img src={getFlagUrl(LAST_RACE.fastestLap.driver)} alt={LAST_RACE.fastestLap.driver} loading="lazy" decoding="async" style={{ width: 24, height: 18, borderRadius: 2, display: 'inline-block', marginRight: 4, verticalAlign: 'text-bottom' }} />
            {LAST_RACE.fastestLap.driver} — {LAST_RACE.fastestLap.time}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            onClick={() => setShareOpen(true)}
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.5)',
              borderRadius: 100,
              padding: '6px 16px',
              boxShadow: '0 4px 15px rgba(245, 158, 11, 0.1)',
            }}
            className="flex items-center gap-1.5 text-[#F59E0B] font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-widest hover:bg-[#F59E0B] hover:text-black transition-all"
            {...(!isMobile && { whileHover: { scale: 1.05 } })}
            whileTap={{ scale: 0.95 }}
          >
            ↗ SHARE
          </motion.button>
          <Link
            to="/standings"
            className="flex items-center gap-1 font-['Space_Grotesk'] text-[10px] font-bold text-[#e10600] uppercase tracking-widest hover:gap-2 transition-all"
          >
            Full Standings <ChevronRight size={12} />
          </Link>
        </div>
      </div>
      <ShareModal isOpen={shareOpen} onClose={() => setShareOpen(false)} raceData={shareData} />
    </motion.div>
  );
}

export default function Home() {
  const shouldReduceMotion = useReducedMotion();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const dur = (d) => shouldReduceMotion ? 0 : isMobile ? d * 0.7 : d;

  const { countdowns, activeWeekend } = useRaceCountdown();
  const { isBeginnerMode } = useMode();

  const heroWords = isBeginnerMode ? ['YOUR', 'F1'] : ['THE', 'KINETIC'];
  const heroAccentText = isBeginnerMode ? 'HEADQUARTERS' : 'OBSERVATORY';

  const [leader, setLeader] = useState({ name: 'Max Verstappen', code: 'VER', team: 'Red Bull Racing' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stars, setStars] = useState(null);

  useEffect(() => {
    const fetchLeader = async () => {
      try {
        setLoading(true);
        const res = await getDrivers(2026);
        if (res.data.drivers && res.data.drivers.length > 0) {
          setLeader(res.data.drivers[0]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLeader();
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch('https://api.github.com/repos/RAJJBHALARA/Box-Box', {
      headers: { Accept: 'application/vnd.github+json' }
    })
      .then((r) => {
        if (!r.ok) throw new Error('GitHub API failed');
        return r.json();
      })
      .then((d) => {
        if (!cancelled && typeof d?.stargazers_count === 'number') {
          setStars(d.stargazers_count);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageTransition>
      <div className="w-full">
        {/* Hero Section */}
        <section className="relative h-[618px] w-full flex items-end overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img
              className="w-full h-full object-cover"
              alt="F1 car on track"
              src="https://images.unsplash.com/photo-1538332576228-eb5b4c4de6f5?q=80&w=2000&auto=format&fit=crop"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/40 to-transparent"></div>
          </div>
          <div className="relative z-10 px-8 pb-16 max-w-screen-2xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-end">
            <div>
              <h1
                className="text-6xl md:text-8xl font-['Space_Grotesk'] font-bold text-white tracking-[-0.04em] leading-tight flex flex-col"
                style={{
                  fontSize: isMobile ? 'clamp(3.5rem, 18vw, 4.8rem)' : undefined,
                  lineHeight: isMobile ? 0.92 : undefined,
                }}
              >
                <span>
                  {heroWords.map((word, i) => (
                    <motion.span
                      key={word}
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.15, duration: dur(0.6), ease: [0.22, 1, 0.36, 1] }}
                      className="inline-block"
                      style={{ marginRight: isMobile ? 12 : 16 }}
                    >
                      {word}
                    </motion.span>
                  ))}
                </span>
                <motion.span
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: dur(0.6), ease: [0.22, 1, 0.36, 1] }}
                  className="text-[#e10600]"
                  style={{
                    display: 'block',
                    fontSize: isMobile ? 'clamp(3rem, 15vw, 4.6rem)' : 'inherit',
                    width: isMobile ? '9ch' : 'auto',
                    maxWidth: isMobile ? '9ch' : 'none',
                    lineHeight: isMobile ? 0.92 : 1,
                    overflowWrap: isMobile ? 'anywhere' : 'normal',
                  }}
                >
                  {heroAccentText}
                </motion.span>
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: dur(0.8) }}
                className="mt-6 text-[#e9bcb5] text-lg leading-relaxed"
                style={{ maxWidth: isMobile ? '18rem' : '28rem' }}
              >
                {isBeginnerMode
                  ? "New to F1? We explain everything in simple terms. No jargon, no confusion — just the thrill of racing."
                  : "Harnessing real-time telemetry from the paddock. Precision analytics engineered for the high-performance spectator."
                }
              </motion.p>
              <a
                href="https://github.com/RAJJBHALARA/Box-Box"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 100,
                  color: 'white',
                  textDecoration: 'none',
                  fontSize: 14,
                  marginTop: 16
                }}
              >
                ⭐ Star on GitHub — {stars !== null ? `${stars.toLocaleString()} Stars` : 'help us reach 5,000 stars'}
              </a>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: dur(0.6) }}
              className="hidden md:flex flex-col items-end gap-3"
            >
              {/* Race Weekend Active Banner */}
              <AnimatePresence>
                {activeWeekend && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="w-80 px-4 py-2 rounded-lg bg-[#e10600]/20 border border-[#e10600]/60 flex items-center gap-2"
                  >
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      className="w-2 h-2 rounded-full bg-[#e10600] flex-shrink-0"
                    />
                    <span className="font-['Space_Grotesk'] text-xs font-bold text-[#e10600] uppercase tracking-widest">
                      LIVE THIS WEEKEND — {activeWeekend.shortName}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Race Countdown Panel */}
              <div className="bg-[#131313]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden w-80 shadow-[0_0_60px_rgba(0,0,0,0.6)]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Flag size={13} className="text-[#e10600]" />
                    <span className="font-['Space_Grotesk'] text-[10px] font-bold tracking-[0.2em] text-[#999999] uppercase">2026 Race Calendar</span>
                  </div>
                  <motion.div
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="flex items-center gap-1"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-[#47efda]" />
                    <span className="text-[9px] text-[#47efda] font-bold uppercase tracking-wider">Live</span>
                  </motion.div>
                </div>

                {/* Countdown Rows */}
                <div className="divide-y divide-white/5">
                  {countdowns.length === 0 ? (
                    <div className="px-5 py-6 text-center">
                      <span className="text-[#999] text-xs">Season Complete 🏆</span>
                    </div>
                  ) : (
                    countdowns.map((race, i) => {
                      const cd = race.countdown;
                      const label = i === 0 ? 'NEXT' : i === 1 ? 'THEN' : 'AFTER';
                      const labelColor = i === 0 ? '#e10600' : i === 1 ? '#ffaa00' : '#999999';
                      return (
                        <motion.div
                          key={race.round}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.6 + i * 0.12, duration: dur(0.4) }}
                          className={`px-5 py-3.5 ${
                            race.isThisWeekend ? 'bg-[#e10600]/5' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span
                                  className="text-[9px] font-bold tracking-[0.2em] uppercase font-['Space_Grotesk']"
                                  style={{ color: labelColor }}
                                >
                                  {label}
                                </span>
                                <span className="text-base">{race.flag}</span>
                                <span className="text-white font-['Space_Grotesk'] font-bold text-xs truncate">
                                  {race.shortName} GP
                                </span>
                              </div>
                              <div className="text-[10px] text-[#666] truncate">
                                {race.circuit} · {race.istTime}
                              </div>
                            </div>

                            {/* Countdown digits */}
                            {cd ? (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {cd.days > 0 && (
                                  <>
                                    <div className="text-center">
                                      <div className={`font-['Space_Grotesk'] font-black text-sm tabular-nums ${
                                        i === 0 ? 'text-white' : 'text-[#666]'
                                      }`}>
                                        {String(cd.days).padStart(2,'0')}
                                      </div>
                                      <div className="text-[8px] text-[#555] uppercase">d</div>
                                    </div>
                                    <div className="text-[#444] text-xs font-bold mb-2">:</div>
                                  </>
                                )}
                                <div className="text-center">
                                  <div className={`font-['Space_Grotesk'] font-black text-sm tabular-nums ${
                                    i === 0 ? 'text-white' : 'text-[#666]'
                                  }`}>
                                    {String(cd.hours).padStart(2,'0')}
                                  </div>
                                  <div className="text-[8px] text-[#555] uppercase">h</div>
                                </div>
                                <div className="text-[#444] text-xs font-bold mb-2">:</div>
                                <div className="text-center">
                                  <div className={`font-['Space_Grotesk'] font-black text-sm tabular-nums ${
                                    i === 0 ? 'text-white' : 'text-[#666]'
                                  }`}>
                                    {String(cd.minutes).padStart(2,'0')}
                                  </div>
                                  <div className="text-[8px] text-[#555] uppercase">m</div>
                                </div>
                                {i === 0 && (
                                  <>
                                    <div className="text-[#444] text-xs font-bold mb-2">:</div>
                                    <div className="text-center">
                                      <div className="font-['Space_Grotesk'] font-black text-sm tabular-nums text-[#e10600]">
                                        {String(cd.seconds).padStart(2,'0')}
                                      </div>
                                      <div className="text-[8px] text-[#555] uppercase">s</div>
                                    </div>
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#e10600] text-[10px] font-bold uppercase">ON NOW</span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 py-2.5 border-t border-white/5 flex items-center gap-1.5">
                  <Zap size={10} className="text-[#e10600]" />
                  <span className="text-[9px] text-[#555] uppercase tracking-widest font-['Space_Grotesk']">All times in IST (UTC+5:30)</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Live Telemetry Dashboard */}
        <section className="max-w-screen-2xl mx-auto px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: dur(0.5) }}
              style={{
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
              }}
              className="md:col-span-2 lg:col-span-2 p-8 flex flex-col justify-between min-h-[400px]"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-['Space_Grotesk'] text-xs font-bold text-[#e10600] tracking-widest uppercase mb-2 block">Current Leader</span>
                  <h2 className="text-4xl font-['Space_Grotesk'] font-bold text-white uppercase tracking-tight flex items-center gap-3">
                    {loading ? 'LOADING...' : (
                      <>
                        <img src={getFlagUrl(leader.code)} alt={leader.code} loading="lazy" decoding="async" style={{ width: 24, height: 18, borderRadius: 2, display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }} />
                        {leader.name}
                      </>
                    )}
                  </h2>
                  {!loading && error && <p style={{ color: "#666", fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>Live data unavailable</p>}
                </div>
                <div className="text-5xl font-['Space_Grotesk'] font-extrabold text-[#ffffff10] italic">01</div>
              </div>
              <div className="mt-8 flex-1 flex items-center justify-center">
                 <DriverImage code={leader.code || 'VER'} name={leader.name} size={200} />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-8 border-t border-white/5 pt-6">
                <div>
                  <span className="text-[10px] text-[#999999] uppercase tracking-widest block mb-1">Interval</span>
                  <span className="text-xl font-['Space_Grotesk'] font-bold text-white">+12.454s</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#999999] uppercase tracking-widest block mb-1">Tires</span>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ffb4ab]"></div>
                    <span className="text-xl font-['Space_Grotesk'] font-bold text-white">SOFT (8L)</span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15, duration: dur(0.5) }}
              style={{
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
              }}
              className="md:col-span-2 lg:col-span-3 p-8 flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-['Space_Grotesk'] text-sm font-bold text-white uppercase tracking-widest">
                  {isBeginnerMode ? 'Speed Comparison' : 'Live Sector Delta'}
                </h3>
                {!isBeginnerMode && (
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-[#01d2be]/10 text-[#47efda] text-[10px] font-bold rounded-full">SECTOR 1: -0.042</span>
                    <span className="px-3 py-1 bg-[#01d2be]/10 text-[#47efda] text-[10px] font-bold rounded-full">SECTOR 2: -0.118</span>
                  </div>
                )}
                {isBeginnerMode && (
                  <span className="text-[11px] text-[#999] font-['Inter']">Each bar shows how fast the car was going in different parts of the track</span>
                )}
              </div>
              <div className="flex-1 flex items-end gap-2 h-full">
                 {[75, 50, 90, 60, 85, 66].map((h, i) => (
                   <motion.div
                     key={i}
                     initial={{ scaleY: 0 }}
                     whileInView={{ scaleY: 1 }}
                     viewport={{ once: true }}
                     transition={{ duration: dur(0.8), delay: i * 0.1 }}
                     style={{ height: `${h}%`, transformOrigin: 'bottom' }}
                     className="flex-1 bg-gradient-to-t from-[#47efda]/20 to-[#47efda]/5 border-t-2 border-[#47efda] relative"
                   />
                 ))}
              </div>
              <div className="mt-6 flex justify-between text-[10px] font-['Space_Grotesk'] text-[#999999] uppercase tracking-widest">
                <span>Lap Start</span>
                <span>Current Lap: 1:32.441</span>
                <span>Finish Line</span>
              </div>
            </motion.div>

            <div className="md:col-span-2 lg:col-span-1 space-y-4">
              {[
                { label: 'Pit Window', value: 'LAP 24', sub: 'Optimal Entry', icon: <Timer size={16} />, color: '#47efda' },
                { label: 'Weather', value: '0% RAIN', sub: 'Clear Skies', icon: <Cloud size={16} />, color: '#999999' },
              ].map((card, i) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.15, duration: dur(0.4) }}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 16,
                  }}
                  className="p-6 flex flex-col justify-between h-[192px]"
                >
                   <span className="text-[10px] font-bold text-[#999999] uppercase tracking-widest">{card.label}</span>
                   <div className="text-4xl font-['Space_Grotesk'] font-bold text-white">{card.value}</div>
                   <div className="flex items-center gap-2" style={{ color: card.color }}>
                     {card.icon}
                     <span className="text-[10px] font-bold uppercase">{card.sub}</span>
                   </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Last Race Summary Card */}
        <section className="max-w-screen-2xl mx-auto px-8 py-10">
          <LastRaceCard dur={dur} />
        </section>

        {/* Email Signup Section */}
        <section style={{ paddingTop: 40, paddingBottom: 20 }}>
          <EmailSignup />
        </section>

        {/* Highlights Section */}
        <section className="max-w-screen-2xl mx-auto px-8 py-16">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12">
              <div>
                <span className="text-[#e10600] font-bold tracking-[0.2em] uppercase text-xs">Deep Dive</span>
                <h2 className="text-4xl font-['Space_Grotesk'] font-bold text-white mt-2">EXPLORE MODULES</h2>
              </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { to: '/race-analysis', title: isBeginnerMode ? 'Who Won & How?' : 'Race Analysis', desc: isBeginnerMode ? 'See which drivers were fastest and how the race unfolded lap by lap. Easy charts anyone can read!' : 'Historical lap times, tire strategies, and race event data visualizations.', cta: 'Explore' },
                { to: '/rivalry-tracker', title: isBeginnerMode ? 'Driver vs Driver' : 'Rivalry Tracker', desc: isBeginnerMode ? 'Pick any two drivers and see who\'s been better this season. Think of it like a scoreboard!' : 'Head-to-head comparison between drivers including qualifying gaps and race results.', cta: 'Compare' },
                { to: '/fantasy-picks', title: isBeginnerMode ? 'AI Dream Team' : 'AI Fantasy Picks', desc: isBeginnerMode ? 'Our AI picks the best drivers for your fantasy team. Like a cheat code for fantasy F1!' : 'Claude 3.5 Sonnet-powered recommendations for your fantasy Formula 1 lineup.', cta: 'Predict' },
              ].map((card, i) => (
                <motion.div
                  key={card.to}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15, duration: dur(0.5) }}
                  {...(!isMobile && { whileHover: { y: -5, borderColor: 'rgba(225,6,0,0.4)', transition: { duration: 0.2 } } })}
                >
                  <Link
                    to={card.to}
                    className="group block p-6 h-full transition-all hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 16,
                    }}
                  >
                      <h3 className="text-xl font-['Space_Grotesk'] font-bold text-white mb-3 group-hover:text-[#e10600] transition-colors">{card.title}</h3>
                      <p className="text-[#e9bcb5] text-sm leading-relaxed mb-6">{card.desc}</p>
                      <span className="text-[#e10600] text-xs font-bold uppercase tracking-widest flex items-center gap-2">{card.cta} <ArrowRight size={14} /></span>
                  </Link>
                </motion.div>
              ))}
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
