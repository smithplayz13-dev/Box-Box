import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useAnimatedCounter } from '../utils/useAnimatedCounter';
import { Thermometer, Flame, Droplet, Wind, AlertTriangle } from 'lucide-react';
import AILoadingBlock from './AILoadingBlock';

const CIRCUIT_COUNTRY = {
  "Albert Park Circuit": "au",
  "Jeddah Corniche Circuit": "sa",
  "Bahrain International Circuit": "bh",
  "Monaco Circuit": "mc",
  "Circuit de Barcelona": "es",
  "Silverstone Circuit": "gb",
  "Monza Circuit": "it",
  "Suzuka Circuit": "jp",
  "Singapore Street Circuit": "sg",
  "Circuit of the Americas": "us",
  "Interlagos Circuit": "br",
  "Yas Marina Circuit": "ae",
  "Hungaroring": "hu",
  "Spa-Francorchamps": "be",
  "Zandvoort Circuit": "nl",
  "Red Bull Ring": "at",
  "Baku City Circuit": "az",
  "Miami International Autodrome": "us",
  "Las Vegas Street Circuit": "us",
  "Lusail International Circuit": "qa",
  "Mexico City Circuit": "mx",
  "Shanghai International Circuit": "cn",
  "Imola Circuit": "it"
};

export default function CircuitInfo({ circuit, aiInsight, aiLoading = false }) {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  const airT = useAnimatedCounter(parseFloat(circuit.environment.airTemp), 1.5, 0.2, true, isInView);
  const trackT = useAnimatedCounter(parseFloat(circuit.environment.trackTemp), 1.5, 0.3, true, isInView);
  const hum = useAnimatedCounter(parseFloat(circuit.environment.humidity), 1.5, 0.4, false, isInView);
  const windS = useAnimatedCounter(parseFloat(circuit.environment.wind), 1.5, 0.5, true, isInView);

  // Stagger variants for historical winners
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } }
  };

  return (
    <section ref={containerRef} className="w-full">
      {/* Top 2 Columns Desktop / 1 Mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Left Column Data */}
        <div className="flex flex-col justify-center space-y-6">
          <div className="flex items-center gap-3">
        <img src={`https://flagcdn.com/24x18/${CIRCUIT_COUNTRY[circuit.circuitName] || 'un'}.png`} alt={circuit.circuitName} loading="lazy" decoding="async" className="w-6 h-4 rounded-sm object-cover" />
             <h3 className="text-[#e10600] font-['Space_Grotesk'] font-bold text-sm uppercase tracking-widest">{circuit.gpName}</h3>
          </div>
          
          <h2 className="text-white font-['Space_Grotesk'] font-bold text-5xl md:text-6xl uppercase leading-none tracking-[-0.02em] break-words">
            {circuit.circuitName}
          </h2>

          <div className="flex items-center gap-4">
             <div className="bg-[#e10600] text-white px-4 py-1.5 rounded-full font-['Space_Grotesk'] font-bold text-xs uppercase tracking-widest">
               {circuit.speedScale} SPEED
             </div>
             <div className="bg-[#1a1a1a] text-[#00d2be] px-4 py-1.5 rounded-full font-['Space_Grotesk'] font-bold text-xs uppercase tracking-widest border border-white/5">
               TOP: {circuit.topSpeed} KM/H
             </div>
          </div>

          <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-white/5">
             <div>
               <p className="text-[#888888] font-['Space_Grotesk'] font-bold text-[10px] uppercase tracking-widest mb-1">Race Length</p>
               <p className="text-white font-bold text-2xl">{circuit.length} <span className="text-sm text-[#888]">km</span></p>
             </div>
             <div>
               <p className="text-[#888888] font-['Space_Grotesk'] font-bold text-[10px] uppercase tracking-widest mb-1">Corners</p>
               <p className="text-white font-bold text-2xl">{circuit.corners}</p>
             </div>
             <div>
               <p className="text-[#888888] font-['Space_Grotesk'] font-bold text-[10px] uppercase tracking-widest mb-1">DRS Zones</p>
               <p className="text-white font-bold text-2xl">{circuit.drsZones}</p>
             </div>
             <div>
               <p className="text-[#888888] font-['Space_Grotesk'] font-bold text-[10px] uppercase tracking-widest mb-1">Lap Record</p>
               <p className="text-white font-bold text-2xl flex flex-col">
                 {circuit.lapRecord.time}
                 <span className="text-[10px] text-[#888] font-medium tracking-wide mt-0.5">{circuit.lapRecord.driver} ({circuit.lapRecord.year})</span>
               </p>
             </div>
          </div>
        </div>

        {/* Right Column Layout Map */}
        <div className="bg-[#1a1a1a]/50 border border-white/5 rounded-xl flex items-center justify-center p-8 min-h-[300px] relative overflow-hidden backdrop-blur-sm">
           <svg className="w-full h-full max-h-[350px] drop-shadow-[0_0_15px_rgba(0,210,190,0.3)]" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">
             {/* Base path outline slightly glowing */}
             <path d={circuit.svgPath} fill="none" stroke="#2a2a2a" strokeWidth="12" strokeLinejoin="round" />
             
             {/* Racing Line Path Draws over 2 seconds */}
             <motion.path 
               d={circuit.svgPath} 
               fill="none" 
               stroke="#00D2BE" 
               strokeWidth="4" 
               strokeLinejoin="round"
               initial={{ pathLength: 0 }}
               whileInView={{ pathLength: 1 }}
               viewport={{ once: true, margin: "-50px" }}
               transition={{ duration: 2.0, ease: "easeInOut" }}
             />

             {/* DRS Zones Highlighting after line reaches end */}
             <motion.path 
               d={circuit.svgPath} 
               fill="none" 
               stroke="#E10600" 
               strokeWidth="8" 
               strokeLinejoin="round" 
               strokeDasharray="40 180" // Approximates zones
               strokeDashoffset="10"
               initial={{ opacity: 0 }}
               whileInView={{ opacity: 1 }}
               viewport={{ once: true }}
               transition={{ delay: 2.2, duration: 0.5 }}
               style={{ filter: 'drop-shadow(0px 0px 8px rgba(225,6,0,0.8))' }}
             />
           </svg>
           {/* Map Label overlays */}
           <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 2.5 }}
              className="absolute bottom-4 right-4 flex items-center gap-3 bg-[#131313]/80 px-3 py-1.5 rounded-sm border border-white/10"
           >
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-[#00D2BE] rounded-full"></div><span className="text-[10px] text-white font-['Space_Grotesk'] font-bold">RACING LINE</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-[#E10600] rounded-full drop-shadow-[0_0_3px_#e10600]"></div><span className="text-[10px] text-white font-['Space_Grotesk'] font-bold">DRS</span></div>
           </motion.div>
        </div>
      </div>

      {/* Bottom Historical Winners */}
      <div className="w-full mb-10">
        <h4 className="text-[#e10600] font-['Space_Grotesk'] font-bold text-sm uppercase tracking-widest mb-4">Historical Winners</h4>
        <motion.div variants={containerVariants} initial="hidden" animate={isInView ? "visible" : "hidden"} className="w-full">
           {circuit.winners.map((winner, index) => (
             <motion.div 
               key={index} 
               variants={itemVariants}
               className={`flex items-center justify-between p-3 border-t border-white/5 ${index % 2 === 0 ? 'bg-[#1c1b1b]' : 'bg-[#131313]'} ${index === 0 ? 'border-l-4' : 'border-l-4 border-transparent'}`}
               style={index === 0 ? { borderLeftColor: '#e10600' } : {}}
             >
                <div className="flex items-center gap-4 w-1/3">
                  <span className="text-white font-bold font-['Space_Grotesk']">{winner.year}</span>
                  <span className="text-white font-bold uppercase text-sm">{winner.driver}</span>
                </div>
                <div className="w-1/3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: winner.teamColor }}></div>
                  <span className="text-[#888] text-xs uppercase tracking-widest font-['Space_Grotesk']">{winner.team}</span>
                </div>
                <div className="w-1/3 text-right">
                   <span className="text-white font-mono text-sm">{winner.time}</span>
                </div>
             </motion.div>
           ))}
        </motion.div>
      </div>

      {/* Environment 4 Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
         <div className="bg-[#1a1a1a]/80 backdrop-blur-md border border-white/5 rounded-xl p-5 flex flex-col items-start gap-4">
            <Thermometer className="text-[#888]" size={20} />
            <div>
               <p className="text-[#888] font-['Space_Grotesk'] font-bold text-[10px] uppercase tracking-widest mb-1">Air Temp</p>
               <p className="text-white font-bold text-2xl">{airT}<span className="text-sm text-[#888]">°C</span></p>
            </div>
         </div>
         <div className="bg-[#1a1a1a]/80 backdrop-blur-md border border-white/5 rounded-xl p-5 flex flex-col items-start gap-4 shadow-[inset_0px_2px_10px_rgba(225,6,0,0.05)]">
            <Flame className="text-[#e10600]" size={20} />
            <div>
               <p className="text-[#888] font-['Space_Grotesk'] font-bold text-[10px] uppercase tracking-widest mb-1">Track Temp</p>
               <p className="text-white font-bold text-2xl">{trackT}<span className="text-sm text-[#888]">°C</span></p>
            </div>
         </div>
         <div className="bg-[#1a1a1a]/80 backdrop-blur-md border border-white/5 rounded-xl p-5 flex flex-col items-start gap-4">
            <Droplet className="text-[#47efda]" size={20} />
            <div>
               <p className="text-[#888] font-['Space_Grotesk'] font-bold text-[10px] uppercase tracking-widest mb-1">Humidity</p>
               <p className="text-white font-bold text-2xl">{hum}<span className="text-sm text-[#888]">%</span></p>
            </div>
         </div>
         <div className="bg-[#1a1a1a]/80 backdrop-blur-md border border-white/5 rounded-xl p-5 flex flex-col items-start gap-4">
            <Wind className="text-[#888]" size={20} />
            <div>
               <p className="text-[#888] font-['Space_Grotesk'] font-bold text-[10px] uppercase tracking-widest mb-1">Wind</p>
               <p className="text-white font-bold text-2xl">{windS}<span className="text-sm text-[#888]">km/h</span></p>
            </div>
         </div>
      </div>

      {/* AI Insight Pitch */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] border-l-4 border-l-[#e10600] rounded-r-xl p-6 relative overflow-hidden drop-shadow-[0_0_10px_rgba(0,212,190,0.05)]">
         <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#e10600] animate-pulse"></div>
            <span className="text-[#e10600] font-['Space_Grotesk'] font-bold text-[10px] uppercase tracking-widest">Pit Wall Alert</span>
         </div>
         {aiLoading ? (
           <AILoadingBlock
             compact
             eyebrow="AI pit wall"
             message="Scanning circuit traits, weather, and strategy patterns."
             detail="Building a quick alert for this track."
             lines={3}
           />
         ) : (
           <p className="text-white text-base leading-relaxed">
             {aiInsight || 'Pit wall alert unavailable right now. Try another session in a moment.'}
           </p>
         )}
         {/* Subtle background icon for depth */}
         <AlertTriangle className="absolute -bottom-6 -right-6 text-white/[0.02] w-48 h-48 pointer-events-none" />
      </div>

    </section>
  );
}
