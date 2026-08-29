import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useEffect, lazy, Suspense, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import BackendWakeup from './components/BackendWakeup';
import OnboardingModal from './components/OnboardingModal';

const Home = lazy(() => import('./pages/Home'));
const RaceAnalysis = lazy(() => import('./pages/RaceAnalysis'));
const RivalryTracker = lazy(() => import('./pages/RivalryTracker'));
const FantasyPicks = lazy(() => import('./pages/FantasyPicks'));
const LapExplainer = lazy(() => import('./pages/LapExplainer'));
const Standings = lazy(() => import('./pages/Standings'));
const DriverCareer = lazy(() => import('./pages/DriverCareer'));
const LiveTiming = lazy(() => import('./pages/LiveTiming'));
const RaceControl = lazy(() => import('./pages/RaceControl'));

function App() {
  const location = useLocation();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    let timer;
    try {
      const done = localStorage.getItem('onboarding_done');
      if (!done) {
        timer = setTimeout(() => {
          setShowOnboarding(true);
        }, 1500);
      }
    } catch {
      // localStorage unavailable — ignore
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <BackendWakeup />
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            fontSize: 14
          },
          success: {
            iconTheme: {
              primary: '#00D2BE',
              secondary: '#000'
            }
          },
          error: {
            iconTheme: {
              primary: '#E10600',
              secondary: '#fff'
            }
          }
        }}
      />
      <AnimatePresence mode="wait">
        <Suspense fallback={
          <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#E10600',
            fontSize: 14
          }}>Loading...</div>
        }>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="live" element={<LiveTiming />} />
              <Route path="race-control" element={<RaceControl />} />
              <Route path="race-analysis" element={<RaceAnalysis />} />
              <Route path="rivalry-tracker" element={<RivalryTracker />} />
              <Route path="fantasy-picks" element={<FantasyPicks />} />
              <Route path="lap-explainer" element={<LapExplainer />} />
              <Route path="standings" element={<Standings />} />
              <Route path="career" element={<DriverCareer />} />
            </Route>
          </Routes>
        </Suspense>
      </AnimatePresence>
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingModal
            onComplete={() => {
              setShowOnboarding(false);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default App;
