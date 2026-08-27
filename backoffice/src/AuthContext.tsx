import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api, User } from './api';
import { PermissionMatrix } from './permissions';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<void>;
  logout: () => void;
  permissions: PermissionMatrix | null;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<PermissionMatrix | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshPermissions = useCallback(async () => {
    if (!localStorage.getItem('token')) {
      setPermissions(null);
      return;
    }
    try {
      const acl = await api.getMyAuthorizations();
      setPermissions(acl.matrix);
    } catch {
      setPermissions(null);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored && localStorage.getItem('token')) {
      setUser(JSON.parse(stored));
      refreshPermissions().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [refreshPermissions]);

  const login = async (email: string, password: string, mfaCode?: string) => {
    const result = await api.login(email, password, mfaCode);
    if (result.mfaRequired) {
      throw new Error('MFA_REQUIRED');
    }
    localStorage.setItem('token', result.accessToken);
    localStorage.setItem('user', JSON.stringify(result.user));
    setUser(result.user);
    if (result.permissions) setPermissions(result.permissions as PermissionMatrix);
    else await refreshPermissions();
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setPermissions(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, permissions, refreshPermissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
