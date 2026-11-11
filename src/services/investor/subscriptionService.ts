import { supabase, nowISO } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';
import {
  currentPeriodKey,
  getPlanDefinition,
  resolvePlan,
  usageDocId,
  type PlanDefinition,
  type SubscriptionPlan,
} from '../../lib/subscriptionPlans';

// AI Engine subscription state: which plan a client is on, and how much of
// this period's allowance they have used.
//
// Phase 1 has no billing. Plans are assigned by staff from the admin users
// page, so we can find out whether anyone actually wants this before building
// payment infrastructure for it.
//
// The usage counter is READ here for display. It is WRITTEN by the
// generateTradingSignal Cloud Function, which is the only place that can
// count reliably - see the note in lib/subscriptionPlans.ts.

export interface AiUsage {
  userId: string;
  period: string;
  signalsUsed: number;
  updatedAt?: Date;
}

export interface SubscriptionState {
  plan: SubscriptionPlan;
  definition: PlanDefinition;
  period: string;
  signalsUsed: number;
  signalsRemaining: number;
  quotaExhausted: boolean;
}

function mapUsage(id: string, data: any): AiUsage {
  return {
    userId: data.user_id ?? data.userId ?? id.split('_')[0] ?? '',
    period: data.period ?? '',
    signalsUsed: Number(data.signals_used ?? data.signalsUsed ?? 0),
    updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
  };
}

/**
 * This period's signal usage. A missing document means zero used - the
 * Cloud Function creates it on first generation.
 */
export async function getUsageForPeriod(
  userId: string,
  period: string = currentPeriodKey(),
): Promise<AiUsage> {
  const empty: AiUsage = { userId, period, signalsUsed: 0 };
  if (!userId) return empty;

  try {
    const { data } = await supabase
      .from(LIVE_COLLECTIONS.aiUsage)
      .select('*')
      .eq('id', usageDocId(userId, period))
      .maybeSingle();
    return data ? mapUsage(data.id!, data) : empty;
  } catch (error) {
    // Usage is a display concern - never block the page on it.
    console.error('Failed to read AI usage:', error);
    return empty;
  }
}

/**
 * Full subscription picture for a client: plan, allowance, and what is left.
 * `plan` comes from the caller (it is already on the profile) so this costs
 * one Supabase read rather than two.
 */
export async function getSubscriptionState(
  userId: string,
  plan: SubscriptionPlan,
): Promise<SubscriptionState> {
  const definition = getPlanDefinition(plan);
  const period = currentPeriodKey();
  const usage = await getUsageForPeriod(userId, period);

  const signalsUsed = usage.signalsUsed;
  const signalsRemaining = Math.max(0, definition.aiSignalsPerMonth - signalsUsed);

  return {
    plan,
    definition,
    period,
    signalsUsed,
    signalsRemaining,
    quotaExhausted: signalsRemaining <= 0,
  };
}

/**
 * Staff action: move a client between plans.
 *
 * Phase 1 is deliberately admin-only. When Phase 5 billing lands, the billing
 * function becomes the caller and this stays as the manual override for
 * support - comps, goodwill credits, and fixing failed charges by hand.
 */
export async function setPlanForUser(userId: string, plan: SubscriptionPlan): Promise<void> {
  await supabase.from(LIVE_COLLECTIONS.profiles).update({
    plan: resolvePlan(plan),
    plan_since: nowISO(),
    updated_at: nowISO(),
  }).eq('id', userId);
}

// ---------------------------------------------------------------------------
// Plan change requests
//
// There is no billing yet (Phase 5), so a client cannot move themselves onto a
// paid plan - RLS blocks writes to profile.plan for exactly that reason.
// Instead a client registers intent here and staff action it from the
// admin users page. Honest about what it is: a request, not a purchase.
// ---------------------------------------------------------------------------

export type PlanRequestStatus = 'pending' | 'approved' | 'declined';

export interface PlanRequest {
  id: string;
  userId: string;
  userEmail?: string;
  currentPlan: SubscriptionPlan;
  requestedPlan: SubscriptionPlan;
  status: PlanRequestStatus;
  note?: string;
  createdAt?: Date;
}

function mapPlanRequest(id: string, data: any): PlanRequest {
  return {
    id,
    userId: data.user_id ?? data.userId ?? '',
    userEmail: data.user_email ?? data.userEmail,
    currentPlan: resolvePlan(data.current_plan ?? data.currentPlan),
    requestedPlan: resolvePlan(data.requested_plan ?? data.requestedPlan),
    status: data.status ?? 'pending',
    note: data.note,
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
  };
}

/** Raise an upgrade request. Staff approve it by changing the plan directly. */
export async function requestPlanChange(input: {
  userId: string;
  userEmail?: string;
  currentPlan: SubscriptionPlan;
  requestedPlan: SubscriptionPlan;
  note?: string;
}): Promise<{ id: string }> {
  const { data } = await supabase.from(LIVE_COLLECTIONS.planRequests).insert({
    user_id: input.userId,
    user_email: input.userEmail ?? '',
    current_plan: input.currentPlan,
    requested_plan: input.requestedPlan,
    status: 'pending',
    note: input.note ?? '',
    created_at: nowISO(),
  }).select('id').single();
  if (!data) throw new Error('Failed to create plan request');
  return { id: data.id! };
}

/** The client's outstanding request, if any - so we don't invite duplicates. */
export async function getPendingPlanRequest(userId: string): Promise<PlanRequest | null> {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from(LIVE_COLLECTIONS.planRequests)
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending');
    if (error) throw error;
    if (!data || data.length === 0) return null;
    return mapPlanRequest(data[0].id!, data[0]);
  } catch (error) {
    console.error('Failed to read plan requests:', error);
    return null;
  }
}

/** Staff view: every outstanding request, keyed by the client's uid. */
export async function getAllPendingPlanRequests(): Promise<Map<string, PlanRequest>> {
  const out = new Map<string, PlanRequest>();
  try {
    const { data, error } = await supabase
      .from(LIVE_COLLECTIONS.planRequests)
      .select('*')
      .eq('status', 'pending');
    if (error) throw error;
    (data ?? []).forEach((d) => {
      const req = mapPlanRequest(d.id!, d);
      out.set(req.userId, req);
    });
  } catch (error) {
    console.error('Failed to read pending plan requests:', error);
  }
  return out;
}

/** Close a request once staff have acted on it, so it stops showing as pending. */
export async function resolvePlanRequest(
  requestId: string,
  status: Exclude<PlanRequestStatus, 'pending'>,
): Promise<void> {
  await supabase.from(LIVE_COLLECTIONS.planRequests).update({
    status,
    resolved_at: nowISO(),
  }).eq('id', requestId);
}
