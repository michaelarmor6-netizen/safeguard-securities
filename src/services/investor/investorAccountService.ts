import { supabase } from '../../config/supabase';
import type {
  InvestorAccountManager,
  InvestorAddress,
  InvestorCompliance,
  InvestorEmployment,
  InvestorInvestmentProfile,
} from './profileService';

export interface CreateInvestorAccountPayload {
  email: string;
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
  idNumber?: string;
  employment: InvestorEmployment;
  investmentProfile: InvestorInvestmentProfile;
  compliance: InvestorCompliance;
  accountManager?: InvestorAccountManager;
}

export interface CreateInvestorAccountResult {
  uid: string;
  temporaryPassword: string;
}

export async function createInvestorAccount(
  payload: CreateInvestorAccountPayload,
): Promise<CreateInvestorAccountResult> {
  const { data, error } = await supabase.rpc('create_investor_account', payload);
  if (error) throw error;
  return data;
}

export async function checkEmailAvailable(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_email_available', { email });
  if (error) throw error;
  return data.available;
}

// ---- staff accounts ----

// Roles a super-admin may create from Settings -> Roles & Permissions.
// 'super_admin' is absent on purpose: it is bootstrapped from the
// SUPER_ADMIN_EMAILS allowlist, and minting one from a form would make that
// allowlist meaningless. 'client' belongs to createInvestorAccount, which
// captures the onboarding record a client needs.
export const CREATABLE_STAFF_ROLES = ['support', 'finance', 'compliance', 'admin'] as const;
export type CreatableStaffRole = (typeof CREATABLE_STAFF_ROLES)[number];

export interface CreateStaffAccountPayload {
  email: string;
  firstName: string;
  lastName: string;
  role: CreatableStaffRole;
}

export interface CreateStaffAccountResult {
  uid: string;
  temporaryPassword: string;
  role: CreatableStaffRole;
}

export async function createStaffAccount(
  payload: CreateStaffAccountPayload,
): Promise<CreateStaffAccountResult> {
  const { data, error } = await supabase.rpc('create_staff_account', payload);
  if (error) throw error;
  return data;
}
