import { supabase, nowISO } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';
import { makeReferralCode } from '../../lib/referralCodes';

// Client referrals.
//
// Two collections, because a code has to be resolvable to an account by
// someone who is not that account:
//   referral_codes/{code}  ->  { user_id }   the lookup, written once by the owner
//   referrals/{id}         ->  the join record, written by the person signing up
//
// Nothing here pays anybody. A referral is recorded, and staff decide what (if
// anything) it earns - there is no automated reward, and no money moves.

export type ReferralStatus = 'signed_up' | 'funded' | 'rejected';

export interface Referral {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  referredEmail?: string;
  code: string;
  status: ReferralStatus;
  createdAt?: Date;
}

function mapReferral(id: string, data: any): Referral {
  return {
    id,
    referrerUserId: data.referrer_user_id ?? data.referrerUserId ?? '',
    referredUserId: data.referred_user_id ?? data.referredUserId ?? '',
    referredEmail: data.referred_email ?? data.referredEmail,
    code: data.code ?? '',
    status: data.status ?? 'signed_up',
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
  };
}

/**
 * This account's referral code, creating the lookup document on first use.
 * Idempotent: the code is derived from the uid, so re-running is harmless.
 */
export async function getOrCreateReferralCode(
  uid: string,
  displayName?: string,
  email?: string,
): Promise<string> {
  const code = makeReferralCode(uid, displayName, email);
  const { data } = await supabase
    .from(LIVE_COLLECTIONS.referralCodes)
    .select('user_id')
    .eq('code', code)
    .maybeSingle();
  if (!data) {
    try {
      await supabase.from(LIVE_COLLECTIONS.referralCodes).insert({
        code,
        user_id: uid,
        created_at: nowISO(),
      });
    } catch (error) {
      // The code itself is still valid and shareable even if the lookup write
      // failed - it just cannot be attributed until the document exists.
      console.error('Failed to ensure referral code document:', error);
    }
  }

  return code;
}

/** Resolve a shared code back to the account that owns it. */
export async function resolveReferralCode(code: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from(LIVE_COLLECTIONS.referralCodes)
      .select('user_id')
      .eq('code', code.trim().toLowerCase())
      .maybeSingle();
    return data ? (data.user_id ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Record that this newly-created account arrived through someone's link.
 * Called once, immediately after signup, by the account that was referred.
 */
export async function recordReferral(input: {
  code: string;
  referredUserId: string;
  referredEmail?: string;
}): Promise<void> {
  const referrerUserId = await resolveReferralCode(input.code);
  if (!referrerUserId) return; // unknown code - ignore quietly
  if (referrerUserId === input.referredUserId) return; // no self-referral

  try {
    await supabase.from(LIVE_COLLECTIONS.referrals).insert({
      referrer_user_id: referrerUserId,
      referred_user_id: input.referredUserId,
      referred_email: input.referredEmail ?? '',
      code: input.code.trim().toLowerCase(),
      status: 'signed_up',
      created_at: nowISO(),
    });
  } catch (error) {
    // Never block signup on referral bookkeeping.
    console.error('Failed to record referral:', error);
  }
}

/** People who joined through this account's link. */
export async function getMyReferrals(uid: string, max = 50): Promise<Referral[]> {
  if (!uid) return [];
  try {
    const { data, error } = await supabase
      .from(LIVE_COLLECTIONS.referrals)
      .select('*')
      .eq('referrer_user_id', uid)
      .order('created_at', { ascending: false })
      .limit(max);
    if (error) throw error;
    return (data ?? []).map((d) => mapReferral(d.id, d));
  } catch (error) {
    console.error('Failed to read referrals:', error);
    return [];
  }
}
