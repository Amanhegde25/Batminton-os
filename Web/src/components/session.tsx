"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";

export interface MeClub {
  id: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  subscriptionPlan: string;
  city: string | null;
}

export interface Me {
  id: string;
  email: string;
  mobile: string | null;
  name: string;
  photoUrl: string | null;
  role: string;
  gender?: string | null;
  skillLevel?: string | null;
  playingStyle?: string | null;
  dominantHand?: string | null;
  preferredTime?: string | null;
  memberships: { role: string; joinedAt: string; club: MeClub }[];
}

interface SessionCtx {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<Me | null>;
  activeClubId: string | null;
  setActiveClubId: (id: string) => void;
  activeMembership: { role: string; club: MeClub } | null;
}

const Ctx = createContext<SessionCtx>({
  me: null,
  loading: true,
  refresh: async () => null,
  activeClubId: null,
  setActiveClubId: () => {},
  activeMembership: null
});

export function useSession() {
  return useContext(Ctx);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeClubId, setClubId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api<Me>("/users/me");
      setMe(data);
      return data;
    } catch {
      setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setActiveClubId = useCallback((id: string) => {
    setClubId(id);
    try {
      localStorage.setItem("bcos-active-club", id);
    } catch {}
  }, []);

  const activeMembership = useMemo(() => {
    if (!me || !activeClubId) return null;
    return me.memberships.find((m) => m.club.id === activeClubId) ?? null;
  }, [me, activeClubId]);

  useEffect(() => {
    if (!me) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("bcos-active-club");
    } catch {}
    const valid = stored && me.memberships.some((m) => m.club.id === stored) ? stored : me.memberships[0]?.club.id ?? null;
    if (valid) setClubId(valid);
  }, [me]);

  return (
    <Ctx.Provider value={{ me, loading, refresh, activeClubId, setActiveClubId, activeMembership }}>
      {children}
    </Ctx.Provider>
  );
}
