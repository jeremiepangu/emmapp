import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { portalApi, PortalAccount, PortalMe, RegisterPortalInput } from './api';

interface PortalContextType {
  account: PortalAccount | null;
  me: PortalMe | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterPortalInput) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const PortalContext = createContext<PortalContextType | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<PortalAccount | null>(null);
  const [me, setMe] = useState<PortalMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    if (!localStorage.getItem('portalToken')) return;
    const profile = await portalApi.me();
    setMe(profile);
    setAccount(profile.account);
    localStorage.setItem('portalAccount', JSON.stringify(profile.account));
  };

  useEffect(() => {
    const stored = localStorage.getItem('portalAccount');
    if (stored && localStorage.getItem('portalToken')) {
      setAccount(JSON.parse(stored));
      refresh().catch(() => {
        localStorage.removeItem('portalToken');
        localStorage.removeItem('portalAccount');
        setAccount(null);
      }).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const applySession = async (result: { accessToken: string; account: PortalAccount }) => {
    localStorage.setItem('portalToken', result.accessToken);
    localStorage.setItem('portalAccount', JSON.stringify(result.account));
    setAccount(result.account);
    await refresh();
  };

  const login = async (email: string, password: string) => {
    await applySession(await portalApi.login(email, password));
  };

  const register = async (data: RegisterPortalInput) => {
    await applySession(await portalApi.register(data));
  };

  const logout = () => {
    localStorage.removeItem('portalToken');
    localStorage.removeItem('portalAccount');
    setAccount(null);
    setMe(null);
  };

  return (
    <PortalContext.Provider value={{ account, me, isLoading, login, register, logout, refresh }}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be used within PortalProvider');
  return ctx;
}
