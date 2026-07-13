'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { authApi, setAccessToken, clearAccessToken, type UserRole } from '@/lib/api';

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  mustResetPw: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ mustResetPw: boolean }>;
  register: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ mustResetPw: boolean }>;
  logout: () => Promise<void>;
  clearMustReset: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeJwtPayload(token: string): { email: string; role: UserRole } {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { email: payload.email as string, role: payload.role as UserRole };
  } catch {
    return { email: '', role: 'Member' };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from httpOnly cookie on mount
  useEffect(() => {
    authApi
      .refresh()
      .then((data) => {
        setAccessToken(data.accessToken);
        setToken(data.accessToken);
        const { email, role } = decodeJwtPayload(data.accessToken);
        setUser({ userId: data.userId, email, role, mustResetPw: data.mustResetPw });
      })
      .catch(() => {
        // No active session — that's fine
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    setAccessToken(data.accessToken);
    setToken(data.accessToken);
    setUser({ userId: data.userId, email, role: data.role, mustResetPw: data.mustResetPw });
    return { mustResetPw: data.mustResetPw };
  }, []);

  const register = useCallback(
    async (email: string, password: string, fullName: string) => {
      const data = await authApi.register(email, password, fullName);
      setAccessToken(data.accessToken);
      setToken(data.accessToken);
      setUser({ userId: data.userId, email, role: data.role, mustResetPw: data.mustResetPw });
      return { mustResetPw: data.mustResetPw };
    },
    [],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    clearAccessToken();
    setToken(null);
    setUser(null);
  }, []);

  const clearMustReset = useCallback(() => {
    setUser((prev) => (prev ? { ...prev, mustResetPw: false } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, isLoading, login, register, logout, clearMustReset }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
