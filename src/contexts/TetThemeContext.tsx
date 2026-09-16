import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TetThemeContextType {
  tetModeEnabled: boolean;
  setTetModeEnabled: (enabled: boolean) => void;
  toggleTetMode: () => void;
}

const TetThemeContext = createContext<TetThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'fun_profile_tet_mode';

export function TetThemeProvider({ children }: { children: ReactNode }) {
  const [tetModeEnabled, setTetModeEnabled] = useState<boolean>(() => {
    // Default to true for Tet season
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? stored === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(tetModeEnabled));
  }, [tetModeEnabled]);

  const toggleTetMode = () => setTetModeEnabled(prev => !prev);

  return (
    <TetThemeContext.Provider value={{ tetModeEnabled, setTetModeEnabled, toggleTetMode }}>
      {children}
    </TetThemeContext.Provider>
  );
}

export function useTetTheme() {
  const context = useContext(TetThemeContext);
  if (context === undefined) {
    throw new Error('useTetTheme must be used within a TetThemeProvider');
  }
  return context;
}
