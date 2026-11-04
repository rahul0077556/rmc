import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi } from "@/api/auth";
import type { Role, User } from "@/types";

const STORAGE_KEY = "rmc.session";

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  hasRole: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const token =
        window.localStorage.getItem("rmc.jwt_token") ||
        window.localStorage.getItem("token");
      if (raw) {
        const parsed = JSON.parse(raw) as User;
        if (!token && !parsed?.token) {
          window.localStorage.removeItem(STORAGE_KEY);
          setUser(null);
        } else {
          setUser(parsed);
        }
      }
    } catch {
      /* ignore corrupted session */
    }
    setReady(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setUser(res.data);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(res.data));
    if (res.data.token) {
      window.localStorage.setItem("rmc.jwt_token", res.data.token);
      window.localStorage.setItem("token", res.data.token);
    }
    return res.data;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem("rmc.jwt_token");
    window.localStorage.removeItem("token");
    void authApi.logout();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      login,
      logout,
      hasRole: (roles: Role[]) => (user ? roles.includes(user.role) : false),
    }),
    [user, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
