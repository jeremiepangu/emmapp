import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, DashboardPanelPref } from './api';

interface ThemeContextType {
  theme: 'clair' | 'sombre';
  setTheme: (theme: 'clair' | 'sombre') => void;
  dashboardLayout: DashboardPanelPref[] | undefined;
  setDashboardLayout: (layout: DashboardPanelPref[]) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const DEFAULT_PANELS: DashboardPanelPref[] = [
  { key: 'kpis', visible: true },
  { key: 'shortcuts', visible: true },
  { key: 'charts', visible: true },
  { key: 'products', visible: true },
  { key: 'pos', visible: true },
  { key: 'orders', visible: true },
  { key: 'payments', visible: true },
  { key: 'observability', visible: true },
];

function mergeLayout(saved?: DashboardPanelPref[]): DashboardPanelPref[] {
  if (!saved?.length) return DEFAULT_PANELS;
  const map = new Map(saved.map((p) => [p.key, p]));
  const merged = DEFAULT_PANELS.map((d) => map.get(d.key) ?? d);
  const extras = saved.filter((p) => !DEFAULT_PANELS.some((d) => d.key === p.key));
  return [...merged, ...extras];
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<'clair' | 'sombre'>(() => {
    const stored = localStorage.getItem('emma-theme');
    return stored === 'sombre' ? 'sombre' : 'clair';
  });
  const [dashboardLayout, setLayoutState] = useState<DashboardPanelPref[] | undefined>(undefined);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('emma-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    api.getPreferences().then((p) => {
      if (p.theme === 'sombre' || p.theme === 'clair') setThemeState(p.theme);
      if (p.dashboardLayout) setLayoutState(mergeLayout(p.dashboardLayout));
    }).catch(() => undefined);
  }, []);

  const persist = (next: { theme?: 'clair' | 'sombre'; dashboardLayout?: DashboardPanelPref[] }) => {
    if (!localStorage.getItem('token')) return;
    api.updatePreferences(next).catch(() => undefined);
  };

  const setTheme = (next: 'clair' | 'sombre') => {
    setThemeState(next);
    persist({ theme: next });
  };

  const setDashboardLayout = (layout: DashboardPanelPref[]) => {
    setLayoutState(layout);
    persist({ dashboardLayout: layout });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, dashboardLayout: mergeLayout(dashboardLayout), setDashboardLayout }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export { DEFAULT_PANELS };
