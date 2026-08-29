import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ModeToggle from './ModeToggle';

export default function Navbar() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stars, setStars] = useState(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('mobileMenuToggle', { detail: { open: mobileMenuOpen } }));
  }, [mobileMenuOpen]);

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

  const links = [
    { name: 'Home', path: '/', navId: 'home' },
    { name: 'Live', path: '/live', navId: 'live' },
    { name: 'Race Analysis', path: '/race-analysis', navId: 'race-analysis' },
    { name: 'Rivalry Tracker', path: '/rivalry-tracker', navId: 'rivalry-tracker' },
    { name: 'Fantasy Picks', path: '/fantasy-picks', navId: 'fantasy-picks' },
    { name: 'Standings', path: '/standings', navId: 'standings' },
    { name: 'Career', path: '/career', navId: 'career' },
    { name: 'Lap Explainer', path: '/lap-explainer', navId: 'lap-explainer' },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9000,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(8, 8, 8, 0.88)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '0 0 12px 12px',
      }}
    >
      <div
        className="w-full mx-auto max-w-screen-2xl"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          height: 60,
          gap: 8,
        }}
      >
        {/* Logo */}
        <Link
          to="/"
          onClick={() => setMobileMenuOpen(false)}
          style={{ flexShrink: 0, marginRight: 16 }}
        >
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2.5"
            style={{ flexShrink: 0 }}
          >
            <div style={{
              width: 32,
              height: 32,
              background: 'linear-gradient(135deg, #e10600, #ff4422)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 900,
              color: 'white',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '-0.05em',
              flexShrink: 0,
            }}>BB</div>
            <span className="text-xl xl:text-2xl font-bold tracking-tighter text-white font-['Space_Grotesk'] uppercase">BoxBox</span>
          </motion.div>
        </Link>

        {/* Desktop/Laptop Links */}
        <div
          className="hidden lg:flex items-center font-['Space_Grotesk'] uppercase gap-[14px] xl:gap-4"
          style={{
            flex: 1,
            justifyContent: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          {links.map((link, i) => {
            const isActive = location.pathname === link.path;
            return (
              <motion.div
                key={link.path}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
                {...(!isMobile && { whileHover: { y: -2 } })}
                data-nav={link.navId}
                style={{ whiteSpace: 'nowrap' }}
              >
                <Link
                  to={link.path}
                  className={`transition-colors text-[12px] xl:text-[13px] ${
                    isActive
                      ? 'text-[#e10600] cursor-default pointer-events-none'
                      : 'text-[#999999] hover:text-white hover:text-[#E10600]'
                  }`}
                  style={{
                    letterSpacing: '0.04em',
                    fontWeight: 600,
                    padding: '8px 0',
                    borderBottom: isActive ? '2px solid #e10600' : '2px solid transparent',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {link.name}
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Right controls */}
        <div className="hidden lg:flex items-center" style={{ gap: 8, flexShrink: 0 }}>
          <div data-nav="mode-toggle">
            <ModeToggle compact />
          </div>

          <a
            href="https://github.com/RAJJBHALARA/Box-Box"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center"
            style={{
              gap: 5,
              padding: '7px 12px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 100,
              color: 'white',
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
            }}
          >
            <span>⭐</span>
            <span className="hidden xl:inline">Star</span>
            {stars !== null && (
              <span
                className="hidden xl:inline-flex"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 100,
                  padding: '1px 6px',
                  fontSize: 11,
                }}
              >
                {stars.toLocaleString()}
              </span>
            )}
          </a>

          <motion.button
            animate={{ 
              boxShadow: [
                "0 0 0px #E10600",
                "0 0 15px #E10600",
                "0 0 0px #E10600"
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="bg-[#e10600] text-white px-4 py-2 rounded-full font-['Space_Grotesk'] font-bold uppercase text-[13px] tracking-[0.06em] hover:bg-[#c00500] active:scale-95 transition-all"
          >
            Live Data
          </motion.button>
        </div>

        {/* Tablet/Mobile Menu Toggle */}
        <button
          className="lg:hidden text-white p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Red gradient line at bottom */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: '10%', right: '10%',
        height: 1,
        background: 'linear-gradient(90deg, transparent, #E10600, transparent)',
        opacity: 0.5,
      }} />

      {/* Tablet/Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(8, 8, 8, 0.96)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              zIndex: 9999,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "1.5rem"
            }}
          >
            {/* Close Button Top Right */}
            <button 
              onClick={() => setMobileMenuOpen(false)}
              style={{
                position: "absolute",
                top: "1.5rem",
                right: "1.5rem",
                color: "white",
                fontSize: "1.5rem",
                background: "none",
                border: "none",
                cursor: "pointer"
              }}
            >
              ✕
            </button>

            {/* Nav links centered in middle */}
            {links.map((link, i) => {
              const isActive = location.pathname === link.path;
              return (
                <motion.div
                  key={link.path}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link
                    to={link.path}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      document.body.style.overflow = "unset";
                    }}
                    style={{
                      color: isActive ? "#e10600" : "white",
                      fontSize: "1.35rem",
                      fontWeight: 700,
                      textDecoration: "none",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase"
                    }}
                    className="font-['Space_Grotesk']"
                  >
                    {link.name}
                  </Link>
                </motion.div>
              );
            })}

            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: 20,
                marginTop: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                alignItems: 'center'
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <ModeToggle compact />
              </motion.div>

              <motion.a
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                href="https://github.com/RAJJBHALARA/Box-Box"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.body.style.overflow = 'unset';
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 24px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 100,
                  color: 'white',
                  textDecoration: 'none',
                  fontSize: 15,
                  fontWeight: 600
                }}
              >
                ⭐ Star on GitHub
                {stars !== null && (
                  <span
                    style={{
                      background: 'rgba(255,215,0,0.15)',
                      color: '#FFD700',
                      borderRadius: 100,
                      padding: '2px 8px',
                      fontSize: 12
                    }}
                  >
                    {stars.toLocaleString()} ★
                  </span>
                )}
              </motion.a>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="bg-[#e10600] text-white px-8 py-3 rounded-full font-['Space_Grotesk'] font-bold uppercase tracking-wider"
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.body.style.overflow = "unset";
                }}
              >
                Live Data
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
