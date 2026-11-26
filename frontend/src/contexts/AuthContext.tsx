import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  title?: string;
  departmentId: string | null;
  departmentName?: string | null;
  roles: string[];
  roleNames?: string[];
  permissions: string[];
}

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  can: (perm: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const cached = localStorage.getItem('itam_user');
    try {
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('itam_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        const merged = { ...(user || {}), ...res.data };
        setUser(merged);
        localStorage.setItem('itam_user', JSON.stringify(merged));
      })
      .catch(() => {
        localStorage.removeItem('itam_token');
        localStorage.removeItem('itam_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password });
    localStorage.setItem('itam_token', res.data.accessToken);
    localStorage.setItem('itam_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem('itam_token');
    localStorage.removeItem('itam_user');
    setUser(null);
  };

  const PERM_ALIASES: Record<string, string[]> = {
    'assets.write': ['assets.create', 'assets.update'],
    'transfers.manage': ['transfers.create', 'transfers.update'],
    'maintenance.manage': ['maintenance.create', 'maintenance.update'],
    'inventory.manage': ['inventory.create', 'inventory.update'],
    'admin.catalogs': ['catalogs.read', 'catalogs.create', 'catalogs.update', 'catalogs.delete'],
    'admin.users': ['users.read', 'users.create', 'users.update', 'users.delete'],
    'admin.settings': ['settings.read', 'settings.create', 'settings.update', 'settings.delete'],
  };

  const can = (perm: string) => {
    if (!user) return false;
    if (user.roles?.includes('SYSTEM_ADMIN')) return true;
    if (user.permissions?.includes(perm)) return true;
    const aliases = PERM_ALIASES[perm];
    return aliases ? aliases.some((a) => user.permissions?.includes(a)) : false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
