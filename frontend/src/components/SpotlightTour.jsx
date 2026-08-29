import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';

const DESKTOP_STEPS = [
  {
    selector: '[data-nav="race-analysis"]',
    emoji: '🏁',
    text: "Start here! Pick any race and see lap times in simple charts",
    position: 'below',
  },
  {
    selector: '[data-nav="rivalry-tracker"]',
    emoji: '⚔️',
    text: "Pick two drivers and see who dominated their battle",
    position: 'below',
  },
  {
    selector: '[data-nav="fantasy-picks"]',
    emoji: '🤖',
    text: "Our AI picks the best team for your F1 Fantasy game",
    position: 'below',
  },
  {
    selector: '[data-nav="standings"]',
    emoji: '🏆',
    text: "See who is currently winning the 2026 championship",
    position: 'below',
  },
  {
    selector: '[data-nav="mode-toggle"]',
    emoji: '🔬',
    text: "Switch to Expert Mode anytime when you're ready for more detail",
    position: 'below',
    isFinal: true,
  },
];

const MOBILE_STEPS = [
  { emoji: '☰', text: 'Tap the menu icon to explore all pages', title: 'Open the Menu' },
  { emoji: '🎚️', text: 'Toggle between Beginner and Expert mode anytime', title: 'Switch Modes' },
  { emoji: '🏁', text: 'Start with Race Analysis to see who was fastest!', title: 'Start Exploring' },
];

// Mini confetti burst on completion
function ConfettiBurst({ onComplete }) {
  const COLORS = ['#E10600', '#F59E0B', '#00D2BE', '#FFFFFF', '#FF6B6B', '#47efda', '#FBBF24', '#e10600'];
  // Confetti particles generated once via ref for stable animation.
  // Math.random here is intentional and non-blocking: useRef ensures
  // one-time initialization; particles are purely decorative.
  const particles = useRef(
    COLORS.map((color) => ({
      color,
      x: (Math.random() - 0.5) * 200,
      y: (Math.random() - 0.5) * 200,
      rotation: Math.random() * 360,
    }))
  ).current;

  useEffect(() => {
    const timer = setTimeout(() => onComplete?.(), 700);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[10002] pointer-events-none flex items-center justify-center">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
          animate={{
            x: p.x,
            y: p.y,
            opacity: 0,
            scale: 0,
            rotate: p.rotation,
          }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: i % 2 === 0 ? '50%' : '2px',
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
}

export default function SpotlightTour({ active, onComplete }) {
  const [step, setStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const steps = isMobile ? MOBILE_STEPS : DESKTOP_STEPS;
  const totalSteps = steps.length;
  const progress = ((step + 1) / totalSteps) * 100;

  // Position spotlight around target element
  const updateSpotlight = useCallback(() => {
    if (isMobile || !active) return;
    const currentStep = DESKTOP_STEPS[step];
    if (!currentStep) return;

    const el = document.querySelector(currentStep.selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      const padding = 8;
      setSpotlightRect({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    }
  }, [step, active, isMobile]);

  useEffect(() => {
    if (!active) return;
    // Defer initial measurement to avoid synchronous setState in effect
    queueMicrotask(updateSpotlight);
    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight);
    return () => {
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight);
    };
  }, [active, updateSpotlight]);

  const handleNext = () => {
    if (step >= totalSteps - 1) {
      handleFinish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleFinish = () => {
    setShowConfetti(true);
    localStorage.setItem('tutorial_seen', 'true');
  };

  const handleConfettiDone = useCallback(() => {
    setShowConfetti(false);
    onComplete?.();
  }, [onComplete]);

  if (!active) return null;

  // ====== MOBILE: card-based steps ======
  if (isMobile) {
    return (
      <AnimatePresence>
        <motion.div
          key="mobile-tour-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000]"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
        />
        <motion.div
          key="mobile-tour-card"
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed inset-0 z-[10001] flex items-center justify-center p-6"
        >
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#1a1a1a', borderTop: '4px solid #F59E0B' }}>
            {/* Progress bar */}
            <div className="h-1 bg-[#333]">
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="h-full bg-[#F59E0B]"
              />
            </div>

            <div className="p-8 text-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="text-4xl mb-4 block">{steps[step].emoji}</span>
                  <h3 className="font-['Space_Grotesk'] font-bold text-white text-lg mb-2">
                    {steps[step].title}
                  </h3>
                  <p className="text-[#999] text-sm font-['Inter'] mb-6">
                    {steps[step].text}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Step dots */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {steps.map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      width: i === step ? 24 : 8,
                      backgroundColor: i === step ? '#F59E0B' : '#444',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="h-2 rounded-full"
                  />
                ))}
              </div>

              <motion.button
                onClick={handleNext}
                {...(!isMobile && { whileHover: { scale: 1.04 } })}
                whileTap={{ scale: 0.97 }}
                className="tutorial-shimmer-btn w-full py-3 rounded-xl font-['Space_Grotesk'] font-bold text-sm uppercase tracking-widest text-black flex items-center justify-center gap-2"
              >
                {step >= totalSteps - 1 ? (
                  <>GOT IT <Check size={16} /></>
                ) : (
                  <>
                    NEXT
                    <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1, repeat: Infinity }}>
                      <ArrowRight size={16} />
                    </motion.span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {showConfetti && <ConfettiBurst onComplete={handleConfettiDone} />}
      </AnimatePresence>
    );
  }

  // ====== DESKTOP: spotlight tour ======
  return (
    <>
      {/* Dark overlay with spotlight cut-out */}
      <AnimatePresence>
        {spotlightRect && (
          <motion.div
            key="spotlight-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[10000] pointer-events-auto"
            onClick={handleNext}
            style={{ cursor: 'pointer' }}
          >
            {/* Spotlight highlight box */}
            <motion.div
              layoutId="spotlight"
              animate={{
                top: spotlightRect.top,
                left: spotlightRect.left,
                width: spotlightRect.width,
                height: spotlightRect.height,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                position: 'fixed',
                borderRadius: 8,
                border: '2px solid #F59E0B',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.8), 0 0 15px rgba(245,158,11,0.3)',
                pointerEvents: 'none',
                zIndex: 10001,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        {spotlightRect && (
          <motion.div
            key={`tooltip-${step}`}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed z-[10002] pointer-events-auto"
            style={{
              top: spotlightRect.top + spotlightRect.height + 16,
              left: Math.max(16, Math.min(spotlightRect.left + spotlightRect.width / 2 - 160, window.innerWidth - 336)),
              width: 320,
            }}
          >
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: '#1a1a1a',
                borderTop: '3px solid #F59E0B',
                boxShadow: '0 16px 40px rgba(0,0,0,0.5), 0 0 20px rgba(245,158,11,0.1)',
              }}
            >
              {/* Progress bar */}
              <div className="h-0.5 bg-[#333]">
                <motion.div
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="h-full bg-[#F59E0B]"
                />
              </div>

              {/* Arrow pointing up */}
              <div
                className="absolute -top-2"
                style={{
                  left: Math.min(Math.max(spotlightRect.left + spotlightRect.width / 2 - Math.max(16, Math.min(spotlightRect.left + spotlightRect.width / 2 - 160, window.innerWidth - 336)), 20), 300),
                  width: 0,
                  height: 0,
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderBottom: '8px solid #F59E0B',
                }}
              />

              <div className="p-5">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0 mt-0.5">{DESKTOP_STEPS[step].emoji}</span>
                  <p className="text-white text-sm font-['Inter'] leading-relaxed">
                    {DESKTOP_STEPS[step].text}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-5">
                  {/* Step dots */}
                  <div className="flex items-center gap-1.5">
                    {DESKTOP_STEPS.map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          width: i === step ? 24 : 8,
                          backgroundColor: i === step ? '#F59E0B' : i < step ? '#F59E0B80' : '#444',
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="h-2 rounded-full"
                      />
                    ))}
                  </div>

                  {/* Action button */}
                  <motion.button
                    onClick={(e) => { e.stopPropagation(); handleNext(); }}
                    {...(!isMobile && { whileHover: { scale: 1.05 } })}
                    whileTap={{ scale: 0.95 }}
                    className="tutorial-shimmer-btn px-5 py-2 rounded-lg font-['Space_Grotesk'] font-bold text-xs uppercase tracking-widest text-black flex items-center gap-1.5"
                  >
                    {DESKTOP_STEPS[step].isFinal ? (
                      <>GOT IT <Check size={14} /></>
                    ) : (
                      <>
                        NEXT
                        <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1, repeat: Infinity }}>
                          <ArrowRight size={14} />
                        </motion.span>
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showConfetti && <ConfettiBurst onComplete={handleConfettiDone} />}
    </>
  );
}
