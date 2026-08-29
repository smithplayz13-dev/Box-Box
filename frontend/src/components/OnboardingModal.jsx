import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMode } from '../context/ModeContext';

const OPTION_STYLES = {
  beginner: {
    hoverBorder: '#F59E0B',
    selectedBorder: '#F59E0B',
    selectedBg: 'rgba(245,158,11,0.1)',
  },
  expert: {
    hoverBorder: '#E10600',
    selectedBorder: '#E10600',
    selectedBg: 'rgba(225,6,0,0.1)',
  },
};

function OptionCard({
  mode,
  icon,
  title,
  subtitle,
  description,
  selected,
  onSelect,
}) {
  const styleTokens = OPTION_STYLES[mode];
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(mode)}
      whileHover={{ scale: 1.02 }}
      style={{
        textAlign: 'left',
        background: selected ? styleTokens.selectedBg : 'rgba(255,255,255,0.03)',
        border: `1px solid ${selected ? styleTokens.selectedBorder : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 16,
        padding: 20,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minHeight: isMobile ? 180 : 200,
        overflow: 'visible'
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = styleTokens.hoverBorder;
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
        }
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <h3 style={{ color: 'white', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{title}</h3>
      <p style={{ color: '#b0b0b0', fontSize: 13, marginBottom: 10 }}>{subtitle}</p>
      <p style={{ color: '#8d8d8d', fontSize: 13, lineHeight: 1.5, margin: 0, whiteSpace: 'normal', wordBreak: 'break-word' }}>{description}</p>
    </motion.button>
  );
}

export default function OnboardingModal({ onComplete }) {
  const { setMode } = useMode();
  const [selection, setSelection] = useState(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const handleContinue = () => {
    if (!selection) return;

    try {
      localStorage.setItem('onboarding_done', 'true');
      localStorage.setItem('boxbox_mode', selection);
      localStorage.removeItem('pitwall_mode');
    } catch {
      // localStorage unavailable — ignore
    }

    setMode(selection);
    onComplete?.(selection);

    if (selection === 'beginner') {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('start-spotlight-tour'));
      }, 350);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Choose your F1 experience level"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 25,
          delay: 0.5,
        }}
        style={{
          background: '#111111',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: 40,
          maxWidth: 520,
          width: '90%',
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            background: 'linear-gradient(135deg, #e10600, #ff4422)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 900,
            color: 'white',
            fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: '-0.05em',
            margin: '0 auto 18px auto',
          }}
        >
          BB
        </div>

        <h2
          style={{
            color: 'white',
            fontSize: 34,
            lineHeight: 1.15,
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: 8,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          Welcome to BoxBox 🏎️
        </h2>

        <p
          style={{
            color: '#9b9b9b',
            textAlign: 'center',
            marginBottom: 24,
            fontSize: 14,
          }}
        >
          Your AI-powered F1 Intelligence Hub
        </p>

        <p
          style={{
            color: 'white',
            textAlign: 'center',
            marginBottom: 16,
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          How familiar are you with Formula 1?
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <OptionCard
            mode="beginner"
            icon="👋"
            title="New to F1"
            subtitle="I'm just getting started"
            description="We'll explain everything in simple terms. No jargon, just the thrill of racing."
            selected={selection === 'beginner'}
            onSelect={setSelection}
          />
          <OptionCard
            mode="expert"
            icon="🏁"
            title="I know F1"
            subtitle="Show me the data"
            description="Full telemetry, sector times, strategy analysis. No hand-holding needed."
            selected={selection === 'expert'}
            onSelect={setSelection}
          />
        </div>

        <button
          type="button"
          disabled={!selection}
          onClick={handleContinue}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: 999,
            padding: '14px 18px',
            background: selection ? '#E10600' : '#5a5a5a',
            color: 'white',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: selection ? 'pointer' : 'not-allowed',
            opacity: selection ? 1 : 0.4,
            transition: 'all 0.2s ease',
          }}
        >
          Continue →
        </button>

        <p style={{ color: '#7f7f7f', textAlign: 'center', marginTop: 10, fontSize: 12 }}>
          You can always change this in settings
        </p>
      </motion.div>
    </motion.div>
  );
}
