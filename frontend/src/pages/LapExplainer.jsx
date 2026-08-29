import { useState, useEffect } from 'react';
import { Play, SkipForward, Info, Timer, Zap, Gauge, Map, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAnimatedCounter } from '../utils/useAnimatedCounter';
import ScrollProgress from '../components/ScrollProgress';
import PageTransition from '../components/PageTransition';
import CustomDropdown from '../components/CustomDropdown';
import AILoadingBlock from '../components/AILoadingBlock';
import { getAvailableRaces, getDrivers, getTelemetry } from '../services/api';
import { getCircuitInfo } from '../utils/circuitData';
import { useMode } from '../context/ModeContext';
import { getLatestCompletedRace, getDefaultYear } from '../utils/currentRace';

const YEAR_OPTIONS = ['2026', '2025', '2024', '2023', '2022', '2021'];
const RESOLVED_DEFAULT_YEAR = YEAR_OPTIONS.includes(getDefaultYear()) ? getDefaultYear() : '2026';
const RESOLVED_DEFAULT_RACE = getLatestCompletedRace(parseInt(RESOLVED_DEFAULT_YEAR));

export default function LapExplainer() {
  const { isBeginnerMode } = useMode();
  
  const [year, setYear] = useState(RESOLVED_DEFAULT_YEAR);
  const [gp, setGp] = useState(RESOLVED_DEFAULT_RACE?.name || 'Japanese Grand Prix');
  const [driver, setDriver] = useState('NOR');
  const [lap, setLap] = useState('10');
  
  const [options, setOptions] = useState({ races: [], drivers: [] });
  const lapOptions = Array.from({length: 80}, (_, i) => String(i + 1));
  
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getErrorMessage = (errorText, raceName, seasonYear) => {
    const normalizedError = String(errorText || '').toLowerCase();

    if (normalizedError.includes('not happened yet') || normalizedError.includes('may be limited')) {
      return {
        title: "Race hasn't happened yet",
        message: `${raceName} ${seasonYear} is scheduled but hasn't been run. Please select a recent completed race like Japanese GP or Bahrain GP.`,
        suggestion: true,
      };
    }

    if (normalizedError.includes('failed to load')) {
      return {
        title: 'Data loading failed',
        message: 'Backend is starting up. Wait 30 seconds and try again.',
        suggestion: false,
      };
    }

    return {
      title: 'Something went wrong',
      message: errorText || 'Please try again',
      suggestion: false,
    };
  };

  useEffect(() => {
    let active = true;
    Promise.all([getAvailableRaces(year), getDrivers(year)])
      .then(([rRes, dRes]) => {
        if (!active) return;
        const races = rRes.data.races || [];
        const drivers = dRes.data.drivers || [];
        setOptions({ races, drivers });
        if (races.length && !races.includes(gp)) {
          const latestCompleted = getLatestCompletedRace(parseInt(year));
          if (latestCompleted?.name && races.includes(latestCompleted.name)) {
            setGp(latestCompleted.name);
          } else {
            setGp(races[races.length - 1]);
          }
        }
        if (drivers.length && !drivers.find(d => d.code === driver)) {
          const nor = drivers.find(d => d.code === 'NOR');
          setDriver((nor || drivers[0]).code);
        }
      }).catch(err => {
        if (!active) return;
        setError(err.message === 'RATE_LIMIT' ? 'Rate limit reached. Please wait.' : 'FAILED TO LOAD OPTIONS');
      });
    return () => { active = false; };
  }, [year]);

  const fetchTelemetry = async (activeRef = { current: true }) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getTelemetry(year, gp, driver, lap);
      console.log('[Telemetry Response]', res.data);

      if (!activeRef.current) return;

      if (res.data?.error) {
        console.error('[Telemetry Error]', res.data.error);
        setTelemetry(null);
        setError(res.data.error);
        return;
      }

      setTelemetry(res.data || null);
    } catch (err) {
      console.error('[Fetch Error]', err);

      if (!activeRef.current) return;

      const errorMessage =
        err.response?.data?.detail ||
        (err.message === 'RATE_LIMIT'
          ? 'Rate limit reached.'
          : err.message === 'REQUEST_TIMEOUT'
            ? 'FAILED TO LOAD TELEMETRY'
            : err.message === 'NO_DATA'
              ? `Telemetry data may be limited for ${gp} ${year}.`
              : err.message || 'Connection failed');

      setTelemetry(null);
      setError(errorMessage);
    } finally {
      if (activeRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!options.races.includes(gp)) return;

    const activeRef = { current: true };
    fetchTelemetry(activeRef);

    return () => {
      activeRef.current = false;
    };
  }, [year, gp, driver, lap, options.races]);

  const maxSpeed = useAnimatedCounter(telemetry?.max_speed || 0, 1.5, 0.5);
  const avgSpeed = useAnimatedCounter(telemetry?.avg_speed || 0, 1.5, 0.8);
  const s1 = useAnimatedCounter(telemetry?.sector1 || 0, 1.5, 1, true);
  const s2 = useAnimatedCounter(telemetry?.sector2 || 0, 1.5, 1.2, true);
  const s3 = useAnimatedCounter(telemetry?.sector3 || 0, 1.5, 1.4, true);

  // Derive circuit info from selected GP for dynamic SVG map
  const circuitInfo = getCircuitInfo(gp);

  const isCorruptedText = (text) => {
    const normalized = String(text || '').trim();
    if (!normalized || normalized.length < 20) return true;
    if (!/^[A-Z]/.test(normalized)) return true;
    if (/(.)\1{3,}/.test(normalized)) return true;

    const doubledConsonants = (normalized.match(/([bcdfghjklmnpqrstvwxyz])\1/gi) || []).length;
    return doubledConsonants > 4;
  };

  const rawAnalysis = String(telemetry?.aiAnalysis || '').trim();
  const showAiLoader = loading || (!error && !telemetry);
  const displayedAnalysis = error
    ? "Analysis temporarily unavailable. Please retry this lap in a moment."
    : !rawAnalysis
      ? "Telemetry summary unavailable for this lap."
      : isCorruptedText(rawAnalysis)
      ? "AI analysis temporarily unavailable. Retrying with clean telemetry summary."
      : rawAnalysis;
  
  const lapTimeStr = telemetry?.lap_time || "--:--.---";
  
  let deltaStr = "";
  if (telemetry?.sector_deltas) {
    const d = telemetry.sector_deltas;
    const sum = d.s1 + d.s2 + d.s3;
    deltaStr = `${sum > 0 ? "+" : ""}${sum.toFixed(3)}s`;
  }

  const shakeVariants = {
    shake: {
      x: [0, -2, 2, -2, 2, 0],
      transition: { duration: 0.4, repeat: 3 }
    }
  };

  return (
    <PageTransition>
      <div className="pt-24 md:pt-28 pb-28 px-4 max-w-5xl mx-auto w-full">
        <ScrollProgress />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
          <div>
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-['Space_Grotesk'] font-bold tracking-[-0.02em] text-white text-3xl"
            >
              LAP <span className="text-[#e10600]">{isBeginnerMode ? 'BREAKDOWN' : 'EXPLAINER'}</span>
            </motion.h1>
            <p className="text-[#e9bcb5] text-sm mt-2 opacity-60">
              {isBeginnerMode ? 'See exactly what a driver did on any lap — speed, time, and AI analysis' : 'AI-Powered Telemetry Breakdown'}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-6">
            <div>
              <CustomDropdown label="Season" value={year} options={YEAR_OPTIONS} onChange={setYear} />
              {parseInt(year) >= 2025 ? (
                <p className="text-[10px] text-[#00D2BE] mt-1 font-bold">✓ LIVE DATA (OPENF1)</p>
              ) : (
                <p className="text-[10px] text-[#666] mt-1">HISTORICAL (FASTF1)</p>
              )}
            </div>
            <CustomDropdown label="Grand Prix" value={gp} options={options.races} onChange={setGp} />
            <CustomDropdown label="Driver" value={driver} options={options.drivers.map(d => d.code)} onChange={setDriver} />
            <CustomDropdown label="Lap" value={lap} options={lapOptions} onChange={setLap} />
          </div>
        </div>

        {error && (() => {
          const errorInfo = getErrorMessage(error, gp, year);
          return (
            <div
              style={{
                padding: 16,
                background: 'rgba(225,6,0,0.1)',
                border: '1px solid rgba(225,6,0,0.3)',
                borderRadius: 12,
                marginBottom: 20,
              }}
            >
              <p style={{ color: '#E10600', fontWeight: 700, marginBottom: 4 }}>
                {errorInfo.title}
              </p>
              <p style={{ color: '#888', fontSize: 13 }}>
                {errorInfo.message}
              </p>
              {errorInfo.suggestion && (
                <button
                  onClick={() => {
                    setGp('Japanese Grand Prix');
                    setYear('2026');
                    setDriver('VER');
                    setLap('10');
                  }}
                  style={{
                    marginTop: 8,
                    padding: '6px 14px',
                    background: '#E10600',
                    border: 'none',
                    borderRadius: 100,
                    color: 'white',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Try Japanese GP 2026 →
                </button>
              )}
            </div>
          );
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Track Map Visualization */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
            }}
            className="lg:col-span-2 p-8 relative overflow-hidden flex flex-col items-center justify-center min-h-[450px]"
          >
            <div className="absolute top-6 left-6 flex items-center gap-2">
              <Map size={16} className="text-[#e10600]" />
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                {circuitInfo?.circuitName || gp.toUpperCase()}
              </span>
            </div>
            
            <div className="relative w-full max-w-md aspect-square flex items-center justify-center">
              <svg viewBox="0 0 400 300" className="w-full h-full drop-shadow-[0_0_20px_rgba(225,6,0,0.15)]">
                {/* Background glow path */}
                <motion.path
                  key={`bg-${gp}`}
                  d={circuitInfo?.svgPath || "M100,100 C200,50 300,50 350,150 C300,250 100,250 50,150 Z"}
                  fill="none"
                  stroke="#e10600"
                  strokeWidth="10"
                  strokeLinejoin="round"
                  className="opacity-10"
                />
                {/* Animated racing line */}
                <motion.path
                  key={`line-${gp}`}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 2.5, ease: "easeInOut" }}
                  d={circuitInfo?.svgPath || "M100,100 C200,50 300,50 350,150 C300,250 100,250 50,150 Z"}
                  fill="none"
                  stroke="#e10600"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Animated dot chasing the path */}
                <motion.circle
                  key={`dot-${gp}`}
                  r="4"
                  fill="white"
                  initial={{ offsetDistance: "0%" }}
                  animate={{ offsetDistance: "100%" }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  style={{
                    offsetPath: `path('${circuitInfo?.svgPath || "M100,100 C200,50 300,50 350,150 C300,250 100,250 50,150 Z"}')`,
                    offsetRotate: "auto"
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="text-center">
                   <p className="text-[10px] text-[#999999] uppercase tracking-[0.2em] mb-1">Current Sector</p>
                   <p className="text-4xl font-['Space_Grotesk'] font-bold text-white tracking-tighter">S3</p>
                 </div>
              </div>
            </div>
          </motion.div>

          {/* Real-time Telemetry Bento */}
          <div className="space-y-6 relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#1c1b1b]/80 rounded-2xl backdrop-blur-sm">
                <div className="w-8 h-8 rounded-full border-2 border-[#e10600]/30 border-t-[#e10600] animate-spin"></div>
              </div>
            )}
            
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              style={{
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
              }}
              className="p-6 flex flex-col justify-between h-[120px]"
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-[#999999] font-bold uppercase tracking-widest">
                {isBeginnerMode ? 'LAP TIME' : 'LAP TIME (REL)'}
              </span>
                <Timer size={14} className="text-[#47efda]" />
              </div>
              <div className="text-3xl font-['Space_Grotesk'] font-bold text-white">
                {lapTimeStr}
                <span className={`text-sm font-normal ml-2 font-body ${deltaStr.startsWith('-') ? 'text-[#47efda]' : 'text-[#e10600]'}`}>{deltaStr}</span>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              style={{
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
              }}
              className="p-6 flex flex-col justify-between h-[120px]"
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-[#999999] font-bold uppercase tracking-widest">
                {isBeginnerMode ? 'HOW FAST?' : 'TELEMETRY SPEEDS'}
              </span>
                <Zap size={14} className="text-[#e10600]" />
              </div>
              <div className="flex items-end justify-between">
                <div>
                   <p className="text-[10px] text-[#999999] uppercase font-bold">MAX SPEED</p>
                   <div className="text-3xl font-['Space_Grotesk'] font-bold text-white">{maxSpeed}<span className="text-sm font-normal text-[#999999] ml-1">KPH</span></div>
                </div>
                <div className="text-right">
                   <p className="text-[10px] text-[#999999] uppercase font-bold">AVG SPEED</p>
                   <p className="text-2xl font-['Space_Grotesk'] font-bold text-white">{avgSpeed}</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              style={{
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
              }}
              className="p-6 flex flex-col justify-between h-[120px]"
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-[#999999] font-bold uppercase tracking-widest">
                {isBeginnerMode ? 'TIME PER SECTION' : 'SECTOR SPLITS'}
              </span>
                <Gauge size={14} className="text-[#e10600]" />
              </div>
              <div className="flex justify-between items-end mt-2">
                 <div className="text-left">
                   <div className="text-[10px] text-[#999999] font-bold">S1</div>
                   <div className="text-lg font-['Space_Grotesk'] text-white font-bold">{s1}s</div>
                 </div>
                 <div className="text-center">
                   <div className="text-[10px] text-[#999999] font-bold">S2</div>
                   <div className="text-lg font-['Space_Grotesk'] text-white font-bold">{s2}s</div>
                 </div>
                 <div className="text-right">
                   <div className="text-[10px] text-[#999999] font-bold">S3</div>
                   <div className="text-lg font-['Space_Grotesk'] text-white font-bold">{s3}s</div>
                 </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Dynamic AI Analysis Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <motion.div 
             initial={{ opacity: 0, y: 30 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             style={{
               background: 'rgba(255,255,255,0.03)',
               backdropFilter: 'blur(12px)',
               WebkitBackdropFilter: 'blur(12px)',
               border: '1px solid rgba(255,255,255,0.08)',
               borderRadius: 16,
             }}
             className="p-8 flex items-start gap-4"
           >
              <div className="bg-[#e10600]/10 p-4 rounded-xl">
                 <Info className="text-[#e10600]" size={24} />
              </div>
              <div>
                 <h3 className="text-xs font-bold text-[#e10600] uppercase tracking-[0.2em] mb-4">
                   {isBeginnerMode ? 'What Happened This Lap?' : 'Telemetric Verdict'}
                 </h3>
                 {showAiLoader ? (
                   <AILoadingBlock
                     compact
                     eyebrow="AI telemetry"
                     message="Reading sector data, speed traces, and lap context."
                     detail="A clean lap verdict will land here once the analysis finishes."
                     lines={3}
                   />
                 ) : (
                   <p className="text-[#e5e2e1] text-lg leading-relaxed font-['Inter']">
                     {displayedAnalysis}
                   </p>
                 )}
              </div>
           </motion.div>

           <motion.div 
             variants={shakeVariants}
             animate={telemetry?.sector_deltas && (telemetry.sector_deltas.s1 + telemetry.sector_deltas.s2 + telemetry.sector_deltas.s3) > 0 ? "shake" : ""}
             style={{
               background: 'rgba(255,255,255,0.03)',
               backdropFilter: 'blur(12px)',
               WebkitBackdropFilter: 'blur(12px)',
               border: '1px solid rgba(225,6,0,0.15)',
               borderRadius: 16,
             }}
             className="p-8 flex flex-col justify-center relative overflow-hidden"
           >
              {loading && (
                <div className="absolute inset-0 z-10 bg-[#1c1b1b]/50 backdrop-blur-[2px]" />
              )}
              <div className="flex items-center gap-3 mb-4">
                 <div className={`w-3 h-3 rounded-full animate-pulse ${deltaStr.startsWith('-') ? 'bg-[#47efda]' : 'bg-[#e10600]'}`}></div>
                 <h3 className="text-xs font-bold text-white uppercase tracking-widest">
                   {isBeginnerMode
                     ? (deltaStr.startsWith('-') ? 'Faster Than Best! 🚀' : 'Slower Than Best ⌛')
                     : (deltaStr.startsWith('-') ? 'Performance Gain Detected' : 'Performance Loss Detected')
                   }
                 </h3>
              </div>
              <div className="flex justify-between items-baseline">
                 <p className={`text-5xl font-['Space_Grotesk'] font-extrabold tracking-tighter ${deltaStr.startsWith('-') ? 'text-[#47efda]' : 'text-[#e10600]'}`}>
                   {deltaStr || "--"}
                 </p>
                 <p className="text-xs text-[#999999] uppercase font-bold">
                   {isBeginnerMode ? 'compared to fastest' : 'VS FASTEST LAP'}
                 </p>
              </div>
              <p className="text-xs text-[#e9bcb5] mt-4 leading-relaxed">
                {telemetry ? `Analysis of lap ${lap} complete.` : 'Waiting for telemetry data...'}
              </p>
           </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
