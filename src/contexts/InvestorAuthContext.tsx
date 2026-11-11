import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../config/supabase';

interface InvestorProfile {
  id: string;
  email: string;
  role?: string;
  accountStatus?: string;
  displayName?: string;
  onboardingCompleted?: boolean;
  onboardingSkipped?: boolean;
  [key: string]: any;
}

interface InvestorAuthContextValue {
  user: any;
  profile: InvestorProfile | null;
  loading: boolean;
  isAdmin: boolean;
  accountStatus: string;
  onboardingCompleted: boolean;
  onboardingSkipped: boolean;
  canBrowseWorkspace: boolean;
  walletBalance: number;
  isFunded: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const InvestorAuthContext = createContext<InvestorAuthContextValue | undefined>(undefined);

export function InvestorAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<InvestorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<InvestorAuthContextValue>(() => ({
    user,
    profile,
    loading,
    isAdmin: false,
    accountStatus: 'active',
    onboardingCompleted: true,
    onboardingSkipped: false,
    canBrowseWorkspace: true,
    walletBalance,
    isFunded: walletBalance > 0,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signUp: async (email, password) => {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
    },
    signOut: async () => { await supabase.auth.signOut(); },
    resetPassword: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    },
    refreshProfile: async () => {},
  }), [user, profile, loading, walletBalance]);

  return <InvestorAuthContext.Provider value={value}>{children}</InvestorAuthContext.Provider>;
}

export function useInvestorAuth() {
  const ctx = useContext(InvestorAuthContext);
  if (!ctx) throw new Error('useInvestorAuth must be used within InvestorAuthProvider');
  return ctx;
}
