import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import type { SessionUser } from "../lib/types";
import type { LoginInput } from "../lib/schemas";
import { api, AUTH_TOKEN_KEY, USER_INFO_KEY, setUnauthorizedHandler } from "../lib/api";
import { storage } from "../lib/storage";

interface AuthContextType {
  user: SessionUser | null;
  token: string | null;
  isLoading: boolean;
  signIn: (input: LoginInput) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStoredAuth() {
      try {
        const storedToken = await storage.getItemAsync(AUTH_TOKEN_KEY);
        const storedUser = await storage.getItemAsync(USER_INFO_KEY);
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser) as SessionUser);
        }
      } catch (e) {
        console.warn("[Auth] Failed to restore session:", e);
      } finally {
        setIsLoading(false);
      }
    }

    void loadStoredAuth();

    setUnauthorizedHandler(() => {
      void signOut();
    });
  }, []);

  async function signIn(input: LoginInput) {
    const res = await api.auth.login(input);
    if (res.token) {
      await storage.setItemAsync(AUTH_TOKEN_KEY, res.token);
      setToken(res.token);
    }
    await storage.setItemAsync(USER_INFO_KEY, JSON.stringify(res.user));
    setUser(res.user);
  }

  async function signOut() {
    try {
      await api.auth.logout();
    } catch {
      // ignore network errors on logout
    }
    await storage.deleteItemAsync(AUTH_TOKEN_KEY);
    await storage.deleteItemAsync(USER_INFO_KEY);
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, token, isLoading, signIn, signOut }),
    [user, token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
