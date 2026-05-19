"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";

import { getFirebaseAuth, firebaseConfigured } from "./firebase";

interface AuthState {
  user: User | null;
  ready: boolean;
  configured: boolean;
}

const Ctx = createContext<AuthState>({
  user: null,
  ready: false,
  configured: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const configured = firebaseConfigured();

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setReady(true);
      return;
    }
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, [configured]);

  return <Ctx.Provider value={{ user, ready, configured }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  return useContext(Ctx);
}

export async function getIdToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  const u = auth?.currentUser;
  if (!u) return null;
  return await u.getIdToken();
}
