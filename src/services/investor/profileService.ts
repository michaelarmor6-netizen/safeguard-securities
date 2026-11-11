import { supabase, nowISO } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';
import { resolveInvestorRole, isSuperAdminEmail, type AccountStatus, type InvestorRole } from '../../lib/investorRoles';
import { resolvePlan, type SubscriptionPlan } from '../../lib/subscriptionPlans';

export interface InvestorAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface InvestorEmployment {
  status: string;
  employer?: string;
  jobTitle?: string;
  annualIncome?: string;
  incomeSource?: string;
}

export interface InvestorInvestmentProfile {
  objective: string;
  riskTolerance: string;
  experienceLevel: string;
  initialFundingIntent?: string;
  sourceOfFunds?: string;
}

export interface InvestorCompliance {
  fatcaStatus?: string;
  crsReporting: boolean;
  pep: boolean;
  sanctionsScreening: boolean;
  amlAcknowledged: boolean;
}

export interface InvestorAccountManager {
  name: string;
  email: string;
  phone?: string;
}

// Client eligibility level for the self-managed Trade Desk (buy/sell placed
// by the client themselves). 'standard' clients cannot self-trade - the desk
// is reserved for advanced (long-partner) and institutional clients; staff
// set the tier in Admin -> Users. Enforced in the UI (InvestorTradeDeskPage).
export type InvestorTier = 'standard' | 'advanced' | 'institutional';

export const INVESTOR_TIERS: InvestorTier[] = ['standard', 'advanced', 'institutional'];

function resolveTier(value: unknown): InvestorTier {
  return value === 'advanced' || value === 'institutional' ? value : 'standard';
}

// Staff roles always pass; clients need advanced/institutional tier.
export function canSelfTrade(profile: any): boolean {
  if (!profile) return false;
  if (profile.role !== 'client') return true;
  const tier = profile.investorTier ?? 'standard';
  return tier === 'advanced' || tier === 'institutional';
}

export interface InvestorProfile {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  role: InvestorRole;
  accountStatus: AccountStatus;
  investorTier?: InvestorTier;
  createdAt?: Date;

  // Onboarding
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: Date;
  onboardingSkipped?: boolean;
  onboardingSource?: 'self' | 'admin';
  createdBy?: string;
  middleName?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: InvestorAddress;
  citizenship?: string;
  residencyCountry?: string;
  idType?: string;
  employment?: InvestorEmployment;
  investmentProfile?: InvestorInvestmentProfile;
  compliance?: InvestorCompliance;
  accountManager?: InvestorAccountManager;

  // AI Engine subscription (Phase 1: assigned by staff, no billing yet)
  plan?: SubscriptionPlan;
  planSince?: Date;
}

export interface OnboardingPayload {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  address: InvestorAddress;
  citizenship: string;
  residencyCountry: string;
  idType?: string;
  employment: InvestorEmployment;
  investmentProfile: InvestorInvestmentProfile;
  compliance: InvestorCompliance;
}

function mapProfile(id: string, data: any): InvestorProfile {
  const email = String(data?.email ?? '');
  return {
    id,
    email,
    username: typeof data.username === 'string' ? data.username : undefined,
    firstName: data.firstName,
    lastName: data.lastName,
    displayName: data.displayName,
    phone: data.phone,
    role: resolveInvestorRole(email, data.role),
    accountStatus: (data.accountStatus as AccountStatus) ?? 'pending',
    investorTier: resolveTier(data.investorTier),
    createdAt: data.createdAt ? new Date(data.createdAt) : undefined,

    onboardingCompleted: Boolean(data.onboardingCompleted),
    onboardingCompletedAt: data.onboardingCompletedAt ? new Date(data.onboardingCompletedAt) : undefined,
    onboardingSkipped: Boolean(data.onboardingSkipped),
    onboardingSource: data.onboardingSource,
    createdBy: data.createdBy,
    middleName: data.middleName,
    dateOfBirth: data.dateOfBirth,
    gender: data.gender,
    address: data.address ?? undefined,
    citizenship: data.citizenship,
    residencyCountry: data.residencyCountry,
    idType: data.idType,
    employment: data.employment ?? undefined,
    investmentProfile: data.investmentProfile ?? undefined,
    compliance: data.compliance ?? undefined,
    accountManager: data.accountManager ?? undefined,
    plan: resolvePlan(data.plan),
    planSince: data.planSince ? new Date(data.planSince) : undefined,
  };
}

export async function getInvestorProfile(uid: string): Promise<InvestorProfile | null> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.profiles)
    .select('*')
    .eq('id', uid)
    .maybeSingle();
  if (error || !data) return null;
  return mapProfile(data.id, data);
}

export async function ensureInvestorProfile(uid: string, email: string) {
  const existing = await getInvestorProfile(uid);
  if (existing) {
    if (isSuperAdminEmail(email) && (existing.role !== 'super_admin' || existing.accountStatus !== 'active')) {
      await supabase
        .from(LIVE_COLLECTIONS.profiles)
        .update({ role: 'super_admin', accountStatus: 'active', updatedAt: nowISO() })
        .eq('id', uid);
      return {
        ...existing,
        role: 'super_admin' as InvestorRole,
        accountStatus: 'active' as AccountStatus,
      };
    }
    return existing;
  }
  const role = resolveInvestorRole(email);
  const accountStatus: AccountStatus = role === 'super_admin' ? 'active' : 'pending';
  const onboardingCompleted = role === 'super_admin';
  const profile: Omit<InvestorProfile, 'id'> = {
    email,
    role,
    accountStatus,
    firstName: role === 'super_admin' ? 'Super' : '',
    lastName: role === 'super_admin' ? 'Admin' : '',
    displayName: role === 'super_admin' ? 'Super Admin' : email.split('@')[0],
    createdAt: new Date(),
    onboardingCompleted,
  };
  await supabase.from(LIVE_COLLECTIONS.profiles).insert({
    ...profile,
    id: uid,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });
  return { id: uid, ...profile };
}

export async function submitClientOnboarding(uid: string, data: OnboardingPayload) {
  await supabase
    .from(LIVE_COLLECTIONS.profiles)
    .update({
      ...data,
      onboardingCompleted: true,
      onboardingCompletedAt: nowISO(),
      onboardingSource: 'self',
      updatedAt: nowISO(),
    })
    .eq('id', uid);
}

export async function skipOnboarding(uid: string) {
  await supabase
    .from(LIVE_COLLECTIONS.profiles)
    .update({ onboardingSkipped: true, updatedAt: nowISO() })
    .eq('id', uid);
}

export async function getAllInvestorProfiles(): Promise<InvestorProfile[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.profiles)
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => mapProfile(d.id, d));
}

export async function getPendingApplicants(): Promise<InvestorProfile[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.profiles)
    .select('*')
    .eq('account_status', 'pending');
  if (error || !data) return [];
  return data.map((d) => mapProfile(d.id, d));
}

export async function updateInvestorProfile(
  uid: string,
  patch: Partial<
    Pick<
      InvestorProfile,
      | 'accountStatus'
      | 'role'
      | 'investorTier'
      | 'firstName'
      | 'lastName'
      | 'phone'
      | 'accountManager'
      | 'address'
      | 'employment'
      | 'investmentProfile'
      | 'plan'
    >
  >,
) {
  await supabase
    .from(LIVE_COLLECTIONS.profiles)
    .update({ ...patch, updated_at: nowISO() })
    .eq('id', uid);
}

export async function deleteInvestorProfile(uid: string) {
  await supabase.from(LIVE_COLLECTIONS.profiles).delete().eq('id', uid);
}
