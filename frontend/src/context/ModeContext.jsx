import { createContext, useContext, useState } from 'react';

const ModeContext = createContext();
const MODE_KEY = 'boxbox_mode';
const LEGACY_MODE_KEY = 'pitwall_mode';
const TUTORIAL_KEY = 'boxbox_tutorial_seen';
const LEGACY_TUTORIAL_KEY = 'pitwall_tutorial_seen';

export const useMode = () => {
  const context = useContext(ModeContext);
  if (!context) throw new Error('useMode must be used within a ModeProvider');
  return context;
};

export const ModeProvider = ({ children }) => {
  const [isBeginnerMode, setIsBeginnerMode] = useState(() => {
    try {
      return (localStorage.getItem(MODE_KEY) || localStorage.getItem(LEGACY_MODE_KEY)) === 'beginner';
    } catch {
      // localStorage unavailable — default to expert mode
      return false;
    }
  });

  const [tutorialSeen, setTutorialSeen] = useState(() => {
    try {
      return (localStorage.getItem(TUTORIAL_KEY) || localStorage.getItem(LEGACY_TUTORIAL_KEY)) === 'true';
    } catch {
      // localStorage unavailable — default to not seen
      return false;
    }
  });

  const toggleMode = () => {
    setIsBeginnerMode(prev => {
      const newMode = !prev;
      try {
        localStorage.setItem(MODE_KEY, newMode ? 'beginner' : 'expert');
        localStorage.removeItem(LEGACY_MODE_KEY);
      } catch {
        // localStorage unavailable — ignore
      }
      return newMode;
    });
  };

  const setMode = (mode) => {
    const nextIsBeginner = mode === 'beginner';
    setIsBeginnerMode(nextIsBeginner);
    try {
      localStorage.setItem(MODE_KEY, nextIsBeginner ? 'beginner' : 'expert');
      localStorage.removeItem(LEGACY_MODE_KEY);
    } catch {
      // localStorage unavailable — ignore
    }
  };

  const dismissTutorial = () => {
    setTutorialSeen(true);
    try {
      localStorage.setItem(TUTORIAL_KEY, 'true');
      localStorage.removeItem(LEGACY_TUTORIAL_KEY);
    } catch {
      // localStorage unavailable — ignore
    }
  };

  return (
    <ModeContext.Provider value={{
      isBeginnerMode,
      toggleMode,
      setMode,
      tutorialSeen,
      dismissTutorial,
    }}>
      {children}
    </ModeContext.Provider>
  );
};
