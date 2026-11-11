// Campaign + enrollment store. The client creates and edits campaigns and
// enrolls leads; the ONLY thing that ever sends an email is the scheduled
// worker in functions-crm. The console cannot send - the same separation
// that keeps origination out of the dialer's web console.
import { supabase, nowISO } from '../../../config/supabase';
import { LIVE_COLLECTIONS } from '../../../config/liveCollections';
import { buildTrack, trackLabel } from './crmFunnelTemplates';
import { findSuppressed } from './crmSuppressionService';
import { getInstrument } from './crmInstrumentService';
import type { CrmLead } from './crmTypes';
import {
  EMPTY_STATS,
  type CampaignStatus, type CampaignTrack, type CrmCampaign, type CrmEnrollment,
} from './crmCampaignTypes';
import type { FunnelStage } from './crmInstrumentTypes';

function mapCampaign(id: string, d: any): CrmCampaign {
  return {
    id,
    name: d.name ?? '',
    track: (d.instrument_slug ?? d.track ?? 'gold') as CampaignTrack,
    instrumentSlug: d.instrument_slug ?? d.track ?? 'gold',
    status: (d.status ?? 'draft') as CampaignStatus,
    steps: Array.isArray(d.steps) ? d.steps : [],
    settings: d.settings ?? {
      fromName: 'SafeGuard Securities', appointmentUrl: '', demoUrl: '',
      companyName: 'SafeGuard Securities', companyAddress: '',
    },
    stats: { ...EMPTY_STATS, ...(d.stats ?? {}) },
    createdBy: d.created_by ?? d.createdBy,
    createdAt: d.created_at ? new Date(d.created_at) : undefined,
    updatedAt: d.updated_at ? new Date(d.updated_at) : undefined,
  };
}

function mapEnrollment(id: string, d: any): CrmEnrollment {
  return {
    id,
    campaignId: d.campaign_id ?? d.campaignId ?? '',
    leadId: d.lead_id ?? d.leadId ?? '',
    email: d.email ?? '',
    firstName: d.first_name ?? d.firstName ?? '',
    step: d.step ?? 0,
    nextSendAt: d.next_send_at ? new Date(d.next_send_at) : new Date(0),
    status: d.status ?? 'active',
    lastError: d.last_error ?? d.lastError,
    enrolledAt: d.enrolled_at ? new Date(d.enrolled_at) : undefined,
    lastSentAt: d.last_sent_at ? new Date(d.last_sent_at) : undefined,
    funnelStage: d.funnel_stage ?? d.funnelStage,
  };
}

export async function listCampaigns(): Promise<CrmCampaign[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.crmCampaigns)
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => mapCampaign(d.id!, d));
}

export async function getCampaign(id: string): Promise<CrmCampaign | null> {
  const { data, error } = await supabase.from(LIVE_COLLECTIONS.crmCampaigns).select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return mapCampaign(data.id!, data);
}

export async function createCampaignFromTrack(
  track: CampaignTrack,
  createdBy: string,
  settings: CrmCampaign['settings'],
): Promise<string> {
  return createCampaignFromInstrument(track, createdBy, settings);
}

export async function createCampaignFromInstrument(
  slug: string,
  createdBy: string,
  settings?: Partial<CrmCampaign['settings']>,
): Promise<string> {
  const instrument = await getInstrument(slug);
  const steps = instrument?.defaultSteps?.length ? instrument.defaultSteps : buildTrack(slug);
  const name = instrument?.name ?? trackLabel(slug);
  const merged: CrmCampaign['settings'] = {
    fromName: 'SafeGuard Securities',
    appointmentUrl: instrument?.defaultAppointmentUrl ?? 'https://safeguardsecurities.us/appointments',
    demoUrl: instrument?.defaultDemoUrl ?? 'https://global.safeguardsecurities.us/signup?demo=1',
    companyName: 'SafeGuard Securities',
    companyAddress: '',
    ...settings,
  };
  const { data } = await supabase.from(LIVE_COLLECTIONS.crmCampaigns).insert({
    name: `${name} — ${new Date().toLocaleDateString()}`,
    track: slug,
    instrument_slug: slug,
    status: 'draft',
    steps,
    settings: merged,
    stats: EMPTY_STATS,
    created_by: createdBy,
    created_at: nowISO(),
    updated_at: nowISO(),
  }).select('id').single();
  if (!data) throw new Error('Failed to create campaign');
  return data.id!;
}

export async function updateCampaign(
  id: string,
  patch: Partial<Pick<CrmCampaign, 'name' | 'status' | 'steps' | 'settings'>>,
): Promise<void> {
  await supabase.from(LIVE_COLLECTIONS.crmCampaigns).update({ ...patch, updated_at: nowISO() }).eq('id', id);
}

export interface EnrollResult { enrolled: number; skippedNoEmail: number; skippedSuppressed: number; alreadyEnrolled: number; }

// Enroll leads into a campaign. Suppression is checked HERE and again by the
// worker at send time - both ends, like DNC in the dialer. Enrollment ids are
// `${campaignId}_${leadId}` so re-enrolling the same lead is a no-op, not a
// duplicate email stream.
export async function enrollLeads(campaign: CrmCampaign, leads: CrmLead[]): Promise<EnrollResult> {
  const result: EnrollResult = { enrolled: 0, skippedNoEmail: 0, skippedSuppressed: 0, alreadyEnrolled: 0 };
  const withEmail = leads.filter((l) => {
    if (!l.email) result.skippedNoEmail++;
    return !!l.email;
  });
  const suppressed = await findSuppressed(withEmail.map((l) => l.email!));

  // read existing enrollment ids - document id is `${campaignId}_${leadId}`
  const candidates = withEmail.filter((l) => {
    if (suppressed.has(l.email!)) { result.skippedSuppressed++; return false; }
    return true;
  });
  const existingIds = await Promise.all(candidates.map((l) =>
    supabase.from(LIVE_COLLECTIONS.crmEnrollments).select('id').eq('id', `${campaign.id!}_${l.id!}`).maybeSingle()));

  const batchable = candidates.filter((_, i) => {
    if (existingIds[i]?.data) { result.alreadyEnrolled++; return false; }
    return true;
  });

  for (let i = 0; i < batchable.length; i += 450) {
    await supabase.from(LIVE_COLLECTIONS.crmEnrollments).insert(
      batchable.slice(i, i + 450).map((lead) => ({
        id: `${campaign.id!}_${lead.id!}`,
        campaign_id: campaign.id!,
        lead_id: lead.id!,
        email: lead.email,
        first_name: lead.firstName || 'there',
        step: 0,
        next_send_at: nowISO(), // step 0 goes out on the worker's next tick
        status: 'active',
        funnel_stage: 'sequenced' as FunnelStage,
        enrolled_at: nowISO(),
      })),
    );
    result.enrolled += Math.min(450, batchable.length - i);
  }

  if (result.enrolled > 0) {
    await supabase.from(LIVE_COLLECTIONS.crmCampaigns).update({
      stats: { ...campaign.stats, enrolled: (campaign.stats.enrolled ?? 0) + result.enrolled },
      updated_at: nowISO(),
    }).eq('id', campaign.id!);
  }
  return result;
}

export async function setEnrollmentStage(enrollmentId: string, funnelStage: FunnelStage): Promise<void> {
  const patch: Record<string, unknown> = { funnel_stage: funnelStage };
  if (funnelStage === 'converted') patch.status = 'completed';
  if (funnelStage === 'exited') patch.status = 'unsubscribed';
  await supabase.from(LIVE_COLLECTIONS.crmEnrollments).update(patch).eq('id', enrollmentId);
}

export async function listEnrollments(campaignId: string): Promise<CrmEnrollment[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.crmEnrollments)
    .select('*')
    .eq('campaign_id', campaignId);
  if (error || !data) return [];
  return data.map((d) => mapEnrollment(d.id!, d));
}
