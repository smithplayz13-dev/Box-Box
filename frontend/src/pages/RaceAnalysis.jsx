import { useState, useEffect } from 'react';
import { ArrowRight, Activity, TrendingUp, Timer, AlertCircle, HelpCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAnimatedCounter } from '../utils/useAnimatedCounter';
import CustomDropdown from '../components/CustomDropdown';
import ScrollProgress from '../components/ScrollProgress';
import { getLapTimes, getTireStrategy, getAvailableRaces, getPitWallAlert } from '../services/api';
import PageTransition from '../components/PageTransition';
import { DRIVER_DATA } from '../utils/teamColors';
import { getFlagUrl } from '../utils/flagHelper';
import CircuitInfo from '../components/CircuitInfo';
import { getCircuitInfo } from '../utils/circuitData';
import { useMode } from '../context/ModeContext';
import ShareModal from '../components/ShareModal';
import { getLatestCompletedRace, getDefaultYear } from '../utils/currentRace';

const YEAR_OPTIONS = ['2026', '2025', '2024', '2023', '2022', '2021'];
const RESOLVED_DEFAULT_YEAR = YEAR_OPTIONS.includes(getDefaultYear()) ? getDefaultYear() : '2026';
const RESOLVED_DEFAULT_RACE = getLatestCompletedRace(parseInt(RESOLVED_DEFAULT_YEAR));

export default function RaceAnalysis() {
  const shouldReduceMotion = useReducedMotion();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const dur = (d) => shouldReduceMotion ? 0 : isMobile ? d * 0.7 : d;

  const [season, setSeason] = useState(RESOLVED_DEFAULT_YEAR);
  const [gp, setGp] = useState(RESOLVED_DEFAULT_RACE?.name || 'Japanese Grand Prix');
  const [session, setSession] = useState('RACE');

  const topSpeed = useAnimatedCounter(342, 1.5, 0.3);
  const pitStop = useAnimatedCounter(2.34, 1.5, 0.5, true);
  const winProb = useAnimatedCounter(87.4, 1.5, 0.7, true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [races, setRaces] = useState([RESOLVED_DEFAULT_RACE?.name || 'Japanese Grand Prix']);
  const [lapData, setLapData] = useState({ drivers: [], laps: {} });
  const [tireStrategy, setTireStrategy] = useState([]);
  
  const circuitData = getCircuitInfo(gp);
  const [aiInsight, setAiInsight] = useState(null);
  const [pitWallLoading, setPitWallLoading] = useState(true);
  const { isBeginnerMode } = useMode();
  const [shareOpen, setShareOpen] = useState(false);
  const isLiveSeason = parseInt(season, 10) >= 2025;

  useEffect(() => {
    let active = true;
    getAvailableRaces(season)
      .then(res => {
        if (!active) return;
        const fetchedRaces = res.data.races || [];
        setRaces(fetchedRaces);
        if (fetchedRaces.length && !fetchedRaces.includes(gp)) {
          const latestCompleted = getLatestCompletedRace(parseInt(season));
          if (latestCompleted?.name && fetchedRaces.includes(latestCompleted.name)) {
            setGp(latestCompleted.name);
          } else {
            setGp(fetchedRaces[fetchedRaces.length - 1]);
          }
        }
      })
      .catch(_err => {
        if (active) setError("Failed to load races for season.");
      });
    return () => { active = false; };
  }, [season]);

  useEffect(() => {
    let active = true;
    setAiInsight(null);
    setPitWallLoading(true);
    getPitWallAlert(circuitData.circuitName)
      .then(res => {
        if (!active) return;
        setAiInsight(res.data.insight);
      })
      .catch(err => {
        if (!active) return;
        console.error("Failed to load pit wall alert", err);
      })
      .finally(() => {
        if (active) setPitWallLoading(false);
      });
    return () => { active = false; };
  }, [gp]);

  useEffect(() => {
    if (!races.includes(gp)) return;

    let active = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        // Format names matching backend requirements
        const shortGp = gp.replace(' GP', '').replace(' CIRCUIT', '').trim();
        const shortSession = session === 'RACE' ? 'R' : session === 'QUALIFYING' ? 'Q' : session === 'SPRINT' ? 'S' : session;
        
        const [lapsRes, tireRes] = await Promise.all([
          getLapTimes(parseInt(season), shortGp, shortSession),
          getTireStrategy(parseInt(season), shortGp)
        ]);
        
        if (active) {
          setLapData(lapsRes.data || { drivers: [], laps: {} });
          setTireStrategy(tireRes.data?.data || []);
        }
      } catch (err) {
        if (active) {
          setError(err.message === 'RATE_LIMIT' ? 'Too many requests. Wait 1 minute.' : 
                    err.message === 'AUTH_ERROR' ? 'Authentication failed.' : 
                    err.message === 'NO_DATA' ? 'Data not available for this selection.' : 
                    'Something went wrong. Try again.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [season, gp, session, races]);

  // Generate SVG path string from array of lap times
  const generatePath = (laps) => {
    if (!laps || laps.length === 0) return '';
    const min = Math.min(...laps);
    const max = Math.max(...laps) || min + 1;
    const range = max - min || 1;
    const stepX = 400 / Math.max(laps.length - 1, 1);
    
    return laps.map((lap, i) => {
       const x = i * stepX;
       const y = 200 - ((lap - min) / range) * 160 - 20; // lower time = lower y visually (higher on graph)
       return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  };

  const d1 = lapData.drivers[0] || 'VER';
  const d2 = lapData.drivers[1] || 'LEC';
  const pathLength1 = generatePath(lapData.laps[d1] || []);
  const pathLength2 = generatePath(lapData.laps[d2] || []);

  return (
    <PageTransition>
      <div className="pt-24 md:pt-28 pb-28 px-4 space-y-8 max-w-5xl mx-auto w-full">
        <ScrollProgress />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur(0.4) }}
          className="flex items-center justify-between"
        >
          <h1 className="font-['Space_Grotesk'] font-bold tracking-[-0.02em] uppercase text-3xl text-[#ffb4a8]">RACE ANALYSIS</h1>
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#F59E0B]/60 text-[#F59E0B] font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-widest hover:bg-[#F59E0B] hover:text-black transition-all"
              {...(!isMobile && { whileHover: { scale: 1.05 } })}
              whileTap={{ scale: 0.95 }}
            >
              ↗ SHARE
            </motion.button>
            <motion.span
              animate={{
                boxShadow: shouldReduceMotion || !isLiveSeason
                  ? 'none'
                  : ['0 0 0px #01d2be', '0 0 10px #01d2be', '0 0 0px #01d2be']
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded ${
                isLiveSeason ? 'text-[#47efda] bg-[#01d2be]/10' : 'text-[#999999] bg-white/5'
              }`}
            >
              {isLiveSeason ? 'LIVE DATA (OPENF1)' : 'Historical data (FastF1)'}
            </motion.span>
          </div>
        </motion.div>

        {/* Dropdown Selectors */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: dur(0.4) }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-white/5 pb-8"
        >
          <div>
            <CustomDropdown label="Season" value={season} options={YEAR_OPTIONS} onChange={setSeason} />
            {parseInt(season) >= 2025 ? (
              <p className="text-[10px] text-[#00D2BE] mt-1 font-bold">✓ LIVE DATA (OPENF1)</p>
            ) : (
              <p className="text-[10px] text-[#666] mt-1">HISTORICAL (FASTF1)</p>
            )}
          </div>
          <CustomDropdown label="Grand Prix" value={gp} options={races} onChange={setGp} />
          <CustomDropdown label="Session" value={session} options={['RACE', 'QUALIFYING', 'SPRINT']} onChange={setSession} />
        </motion.section>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-red-900/20 border border-red-500/50 rounded flex items-center gap-3 text-red-500 mb-8">
            <AlertCircle size={20} />
            <span className="font-['Space_Grotesk'] font-bold uppercase tracking-widest text-sm">{error}</span>
          </motion.div>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          key={gp} // Force remount to trigger animations smoothly on GP change
          transition={{ duration: dur(0.5) }}
        >
           <CircuitInfo circuit={circuitData} aiInsight={aiInsight} aiLoading={pitWallLoading} />
        </motion.div>

        {/* Lap Time Evolution */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
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
          className="overflow-hidden shadow-lg"
        >
          <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h2 className="font-['Space_Grotesk'] font-bold text-xl tracking-[-0.02em] uppercase text-white">
                {isBeginnerMode ? 'WHO WAS FASTEST?' : 'LAP TIME EVOLUTION'}
              </h2>
              <p className="text-sm text-[#e9bcb5] mt-1">
                {isBeginnerMode
                  ? 'Each line shows one driver. Lower = faster lap time.'
                  : 'Comparison between leaders (Lap 1 - 78)'
                }
              </p>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 bg-[#e10600]"></span>
                <span className="flex items-center gap-1.5 text-xs font-['Space_Grotesk'] font-bold uppercase text-white">
                  <img src={getFlagUrl(d1)} alt={d1} loading="lazy" decoding="async" style={{ width: 16, height: 12, borderRadius: 1 }} />
                  {d1}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 bg-white"></span>
                <span className="flex items-center gap-1.5 text-xs font-['Space_Grotesk'] font-bold uppercase text-white">
                  <img src={getFlagUrl(d2)} alt={d2} loading="lazy" decoding="async" style={{ width: 16, height: 12, borderRadius: 1 }} />
                  {d2}
                </span>
              </div>
            </div>
          </div>
          <div className="h-80 relative p-4 overflow-hidden bg-[radial-gradient(circle,#ffffff05_1px,transparent_1px)]" style={{ backgroundSize: '24px 24px' }}>
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                 <div className="w-8 h-8 rounded-full border-2 border-[#e10600]/20 border-t-[#e10600] animate-spin"></div>
              </div>
            ) : (
              <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                <motion.path
                  d={pathLength1}
                  fill="none"
                  stroke="#e10600"
                  strokeWidth="2.5"
                  className="drop-shadow-[0_0_8px_rgba(225,6,0,0.4)]"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: dur(1.5), ease: 'easeInOut' }}
                />
                <motion.path
                  d={pathLength2}
                  fill="none"
                  stroke="#e5e2e1"
                  strokeWidth="2.5"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: dur(1.5), ease: 'easeInOut', delay: 0.2 }}
                />
              </svg>
            )}
            <div className="absolute inset-0 flex pointer-events-none">
              <div className="flex-1 border-r border-[#ffffff05]"></div>
              <div className="flex-1 border-r border-[#ffffff05]"></div>
              <div className="flex-1 border-r border-[#ffffff05]"></div>
              <div className="flex-1 border-r border-[#ffffff05]"></div>
            </div>
          </div>
        </motion.section>

        {/* Tire Strategy */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
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
          className="overflow-hidden shadow-lg"
        >
          <div className="p-6">
            <h2 className="font-['Space_Grotesk'] font-bold text-xl tracking-[-0.02em] uppercase text-white">
              {isBeginnerMode ? 'WHEN DID DRIVERS CHANGE TIRES?' : 'TIRE STRATEGY'}
            </h2>
            {isBeginnerMode && (
              <p className="text-sm text-[#e9bcb5] mt-2">
                Each coloured bar represents a different tire type. Drivers change tires during pit stops to go faster.
              </p>
            )}
            <div className="mt-8 space-y-8">
              {loading ? (
                <div className="space-y-4 animate-pulse">
                   {[1,2,3].map(i => (
                     <div key={i} className="flex flex-col gap-2">
                       <div className="h-4 w-32 bg-white/5 rounded"></div>
                       <div className="h-10 w-full bg-white/5 rounded-full"></div>
                     </div>
                   ))}
                </div>
              ) : tireStrategy.slice(0, 5).map((driver, di) => {
                const totalLaps = driver.stints.reduce((sum, s) => sum + s.laps, 0) || 1;
                const stops = driver.pit_laps?.length || 0;
                const detail = `${stops} STOP${stops !== 1 ? 'S' : ''} ${stops > 0 ? `(LAP ${driver.pit_laps.join(', ')})` : ''}`;

                return (
                  <div key={driver.driver} className="space-y-3">
                    <div className="flex justify-between items-center text-xs font-['Space_Grotesk'] font-bold uppercase tracking-widest text-white">
                      <span className="flex items-center gap-1.5">
                         <img src={getFlagUrl(driver.driver)} alt={driver.driver} loading="lazy" decoding="async" style={{ width: 18, height: 14, borderRadius: 1 }} />
                        {driver.driver}
                      </span>
                      <span className="text-[#e9bcb5]">{detail}</span>
                    </div>
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: dur(0.8), delay: di * 0.1 }}
                      style={{ transformOrigin: 'left' }}
                      className="h-10 w-full flex rounded-full overflow-hidden bg-[#353534] shadow-inner"
                    >
                      {driver.stints.map((seg, si) => {
                        const compoundChar = String(seg.compound)[0]?.toUpperCase() || 'U';
                        const bg = compoundChar === 'S' ? 'bg-red-600' : compoundChar === 'M' ? 'bg-yellow-400' : 'bg-white';
                        const text = compoundChar === 'S' ? 'text-white' : 'text-black';
                        return (
                          <div
                            key={si}
                            className={`h-full ${bg} flex items-center justify-center ${si > 0 ? 'border-l-4 border-black/20' : ''}`}
                            style={{ width: `${(seg.laps / totalLaps) * 100}%` }}
                          >
                            <span className={`text-xs font-black ${text}`}>{compoundChar}</span>
                          </div>
                        );
                      })}
                    </motion.div>
                  </div>
                )
              })}
            </div>
            
            <div className="mt-10 pt-6 border-t border-white/5 flex justify-center gap-8 flex-wrap">
              {[
                { color: 'bg-red-600', label: 'Soft', emoji: '🔴', explain: 'Fastest but wears out quickly' },
                { color: 'bg-yellow-400', label: 'Medium', emoji: '🟡', explain: 'Good balance of speed & life' },
                { color: 'bg-white border border-[#353534]', label: 'Hard', emoji: '⚪', explain: 'Slowest but lasts the longest' },
              ].map(t => (
                <div key={t.label} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${t.color}`}></div>
                  <span className="text-xs font-['Space_Grotesk'] font-bold uppercase text-[#e9bcb5]">
                    {isBeginnerMode ? `${t.emoji} ${t.label} = ${t.explain}` : t.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Bento Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: dur(0.4) }}
            {...(!isMobile && { whileHover: { y: -3, transition: { duration: 0.2 } } })}
            style={{
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
            }}
            className="p-8 flex flex-col justify-between aspect-square md:aspect-auto h-48"
          >
            <Activity className="text-[#e10600] mb-4" size={28} />
            <div>
              <div className="text-xs font-['Space_Grotesk'] font-bold text-[#e9bcb5] uppercase tracking-wider mb-2">
                {isBeginnerMode ? 'Fastest Speed' : 'Top Speed'}
                {isBeginnerMode && (
                  <span className="relative ml-1.5 group inline-block">
                    <HelpCircle size={12} className="text-[#666] inline cursor-help" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#2a2a2a] text-[#e9bcb5] text-[10px] rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">The fastest speed any car reached on a straight</span>
                  </span>
                )}
              </div>
              <div className="text-4xl font-['Space_Grotesk'] font-bold text-white">{topSpeed}<span className="text-lg font-medium ml-1 text-[#e9bcb5]">km/h</span></div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: dur(0.4) }}
            {...(!isMobile && { whileHover: { y: -3, transition: { duration: 0.2 } } })}
            style={{
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
            }}
            className="p-8 flex flex-col justify-between aspect-square md:aspect-auto h-48"
          >
            <Timer className="text-[#47efda] mb-4" size={28} />
            <div>
              <div className="text-xs font-['Space_Grotesk'] font-bold text-[#e9bcb5] uppercase tracking-wider mb-2">
                {isBeginnerMode ? 'Tire Change Time' : 'Avg. Pit Stop'}
                {isBeginnerMode && (
                  <span className="relative ml-1.5 group inline-block">
                    <HelpCircle size={12} className="text-[#666] inline cursor-help" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#2a2a2a] text-[#e9bcb5] text-[10px] rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">How long it takes to change all 4 tires in a pit stop</span>
                  </span>
                )}
              </div>
              <div className="text-4xl font-['Space_Grotesk'] font-bold text-white">{pitStop}<span className="text-lg font-medium ml-1 text-[#e9bcb5]">s</span></div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: dur(0.4) }}
            {...(!isMobile && { whileHover: { y: -3, transition: { duration: 0.2 } } })}
            style={{
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
            }}
            className="col-span-1 md:col-span-2 lg:col-span-1 p-8 flex items-center justify-between h-48"
          >
            <div>
              <div className="text-xs font-['Space_Grotesk'] font-bold text-[#e9bcb5] uppercase tracking-wider mb-2">
                {isBeginnerMode ? 'Chance of Winning' : 'Win Probability'}
              </div>
              <div className="text-5xl font-['Space_Grotesk'] font-bold text-[#e10600]">{winProb}%</div>
            </div>
            <motion.div
              animate={shouldReduceMotion ? {} : { rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="w-20 h-20 rounded-full border-4 border-[#353534] border-t-[#e10600] flex items-center justify-center"
            >
              <TrendingUp className="text-[#e10600]" size={28} />
            </motion.div>
          </motion.div>
        </section>
      </div>
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        raceData={{
          raceName: gp.replace(' GRAND PRIX', ' GP').replace(' Grand Prix', ' GP'),
          round: `${season} Season`,
          year: season,
          p1: lapData.drivers[0]
            ? { code: lapData.drivers[0], name: lapData.drivers[0], team: DRIVER_DATA[lapData.drivers[0]]?.team || 'F1', pts: '+25' }
            : { code: 'P1', name: 'Race Winner', team: 'F1 Team', pts: '+25' },
          p2: lapData.drivers[1]
            ? { code: lapData.drivers[1], name: lapData.drivers[1], team: DRIVER_DATA[lapData.drivers[1]]?.team || 'F1', pts: '+18' }
            : { code: 'P2', name: 'P2 Driver', team: 'F1 Team', pts: '+18' },
          p3: lapData.drivers[2]
            ? { code: lapData.drivers[2], name: lapData.drivers[2], team: DRIVER_DATA[lapData.drivers[2]]?.team || 'F1', pts: '+15' }
            : { code: 'P3', name: 'P3 Driver', team: 'F1 Team', pts: '+15' },
          fastestLap: { driver: lapData.drivers[0] || 'Fastest Driver', time: '—' },
        }}
      />
    </PageTransition>
  );
}
