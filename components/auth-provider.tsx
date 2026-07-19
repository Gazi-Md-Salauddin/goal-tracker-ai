'use client';

import * as React from 'react';
import type { User } from '@/lib/types';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

function userFromSupabase(u: {
  id: string;
  email?: string | null;
  user_metadata?: { name?: string; full_name?: string } | null;
  created_at?: string;
}): User {
  const name =
    u.user_metadata?.name ||
    u.user_metadata?.full_name ||
    (u.email ? u.email.split('@')[0] : 'User');
  return {
    id: u.id,
    name,
    email: u.email ?? '',
    createdAt: u.created_at ?? new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session?.user) {
          setUser(userFromSupabase(data.session.user));
          setLoading(false);
          return;
        }
      } catch {
        // ignore — fall back to localStorage session
      }

      const localUser = await api.me();
      if (cancelled) return;
      setUser(localUser);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          setUser(userFromSupabase(session.user));
        } else {
          const local = await api.me();
          if (!local) setUser(null);
        }
      })();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    async login(email, password) {
      const u = await api.login(email, password);
      setUser(u);
    },
    async register(name, email, password) {
      const u = await api.register(name, email, password);
      setUser(u);
    },
    async logout() {
      await api.logout();
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
      setUser(null);
    },
    async signInWithGoogle(redirectTo) {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : '';
      const next = redirectTo ?? '/dashboard';
      const redirectToUrl = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectToUrl },
      });
      if (error) throw error;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
