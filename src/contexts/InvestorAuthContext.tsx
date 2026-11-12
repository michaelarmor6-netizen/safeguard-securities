import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../config/supabase';
import {
  ensureInvestorProfile,
  getInvestorProfile,
  type InvestorProfile as ServiceInvestorProfile,
} from '../services/investor/profileService';
import { getUserWallet } from '../services/investor/walletService';
import { isInvestorAdmin } from '../lib/investorRoles';

// Re-exported for consumers; an index signature keeps the previously-loose
// context profile shape compatible (pages may read extra Firestore-era fields).
export type InvestorProfile = ServiceInvestorProfile & { [key: string]: any };

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

  // Load (or lazily create) the profile row, then hydrate the wallet balance.
  // Falls back to a read-only fetch when the upsert path fails (e.g. the
  // profiles table or its policies are not provisioned yet), so an existing
  // session still resolves instead of bricking the workspace.
  const hydrate = useCallback(async (uid: string, email: string) => {
    let loaded: InvestorProfile | null = null;
    try {
      loaded = (await ensureInvestorProfile(uid, email)) as InvestorProfile;
    } catch (err) {
      console.error('investor profile upsert failed, falling back to read', err);
      try {
        loaded = (await getInvestorProfile(uid)) as InvestorProfile | null;
      } catch {
        /* profile stays null; guards will route to activation/onboarding */
      }
    }
    if (loaded) setProfile(loaded);
    try {
      const wallet = await getUserWallet(uid);
      setWalletBalance(Number(wallet?.balance ?? 0));
    } catch (err) {
      console.error('wallet load failed', err);
      setWalletBalance(0);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      const u = session?.user ?? null;
      setUser(u);
      if (u?.id) await hydrate(u.id, u.email ?? '');
      if (!cancelled) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u?.id) {
        hydrate(u.id, u.email ?? '');
      } else {
        setProfile(null);
        setWalletBalance(0);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [hydrate]);

  const isAdmin = useMemo(() => (profile ? isInvestorAdmin(profile.role) : false), [profile]);
  const accountStatus = profile?.accountStatus ?? 'pending';
  const onboardingCompleted = profile?.onboardingCompleted ?? false;
  const onboardingSkipped = profile?.onboardingSkipped ?? false;
  // Staff/admin accounts are never onboarding-gated; clients need the 7-step
  // flow completed (or deliberately skipped) before browsing the workspace.
  const canBrowseWorkspace = isAdmin || onboardingCompleted || onboardingSkipped;

  const value = useMemo<InvestorAuthContextValue>(() => ({
    user,
    profile,
    loading,
    isAdmin,
    accountStatus,
    onboardingCompleted,
    onboardingSkipped,
    canBrowseWorkspace,
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
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
      setWalletBalance(0);
    },
    resetPassword: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    },
    refreshProfile: async () => {
      if (user?.id) await hydrate(user.id, user.email ?? '');
    },
  }), [
    user, profile, loading, isAdmin, accountStatus, onboardingCompleted,
    onboardingSkipped, canBrowseWorkspace, walletBalance, hydrate,
  ]);

  return <InvestorAuthContext.Provider value={value}>{children}</InvestorAuthContext.Provider>;
}

export function useInvestorAuth() {
  const ctx = useContext(InvestorAuthContext);
  if (!ctx) throw new Error('useInvestorAuth must be used within InvestorAuthProvider');
  return ctx;
}
