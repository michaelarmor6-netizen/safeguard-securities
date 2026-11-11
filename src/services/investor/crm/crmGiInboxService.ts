// The GI Inbox: pending batches pushed by Guma Intelligence, awaiting the
// same human decision every other intake gets. Accepting writes crmLeads
// with the GI provenance preserved (source gi:{mission}, giLeadId intact -
// the join key that lets dispositions flow back to GI in phase 4, and the
// value Vicidial exports carry as vendor_lead_code).
import { supabase, nowISO } from '../../../config/supabase';
import { LIVE_COLLECTIONS } from '../../../config/liveCollections';
import { findExisting } from './crmLeadService';
import type { ConsentBasis } from './crmTypes';

export interface GiInboundLead {
  id: string;
  giLeadId: string;
  mission: string;
  segment: string;
  lead: {
    firstName: string; lastName: string; company?: string;
    phoneE164?: string; email?: string; country?: string;
    consentBasis: ConsentBasis; consentSource: string; tags: string[];
  };
  dossier: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'declined';
  receivedAt?: Date;
  reviewedByEmail?: string;
  declineReason?: string;
}

function mapInbound(id: string, d: any): GiInboundLead {
  return {
    id,
    giLeadId: d.gi_lead_id ?? d.giLeadId ?? '',
    mission: d.mission ?? 'unspecified',
    segment: d.segment ?? 'investor-prospect',
    lead: {
      firstName: d.lead?.first_name ?? d.lead?.firstName ?? '',
      lastName: d.lead?.last_name ?? d.lead?.lastName ?? '',
      company: d.lead?.company ?? undefined,
      phoneE164: d.lead?.phone_e164 ?? d.lead?.phoneE164 ?? undefined,
      email: d.lead?.email ?? undefined,
      country: d.lead?.country ?? undefined,
      consentBasis: (d.lead?.consent_basis ?? d.lead?.consentBasis ?? 'unknown') as ConsentBasis,
      consentSource: d.lead?.consent_source ?? d.lead?.consentSource ?? '',
      tags: Array.isArray(d.lead?.tags) ? d.lead.tags : [],
    },
    dossier: d.dossier ?? {},
    status: d.status ?? 'pending',
    receivedAt: d.received_at ? new Date(d.received_at) : undefined,
    reviewedByEmail: d.reviewed_by_email ?? d.reviewedByEmail,
    declineReason: d.decline_reason ?? d.declineReason,
  };
}

export async function listGiInbox(status: GiInboundLead['status'] = 'pending'): Promise<GiInboundLead[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.crmInbound)
    .select('*')
    .eq('status', status)
    .order('received_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => mapInbound(d.id, d));
}

export interface GiAcceptResult { accepted: number; duplicates: number; }

// Accept pending GI leads into crmLeads. Store-level dedupe runs here (by
// phone and email against the whole store) - the webhook already handled
// batch idempotency and suppression at the door.
export async function acceptGiLeads(items: GiInboundLead[], reviewerEmail: string): Promise<GiAcceptResult> {
  const pending = items.filter((i) => i.status === 'pending');
  const existing = await findExisting(
    pending.map((i) => i.lead.phoneE164 ?? ''),
    pending.map((i) => i.lead.email ?? ''),
  );

  let accepted = 0, duplicates = 0;
  for (let i = 0; i < pending.length; i += 200) {   // 2 writes per item, keep chunks small
    for (const item of pending.slice(i, i + 200)) {
      const isDup =
        (item.lead.phoneE164 && existing.has(item.lead.phoneE164)) ||
        (item.lead.email && existing.has(item.lead.email));
      if (isDup) {
        duplicates++;
        await supabase.from(LIVE_COLLECTIONS.crmInbound).update({
          status: 'declined', decline_reason: 'already in the CRM',
          reviewed_by_email: reviewerEmail, reviewed_at: nowISO(),
        }).eq('id', item.id);
        continue;
      }
      await supabase.from(LIVE_COLLECTIONS.crmLeads).insert({
        first_name: item.lead.firstName,
        last_name: item.lead.lastName,
        company: item.lead.company ?? null,
        phone_e164: item.lead.phoneE164 ?? null,
        email: item.lead.email ?? null,
        country: item.lead.country ?? null,
        tags: [...new Set([...item.lead.tags, item.segment])],
        status: 'new',
        source: { kind: 'gi', mission: item.mission },
        consent_basis: item.lead.consentBasis,
        consent_note: item.lead.consentSource,
        gi_lead_id: item.giLeadId,
        payload: item.dossier,
        created_at: nowISO(),
        updated_at: nowISO(),
      });
      await supabase.from(LIVE_COLLECTIONS.crmInbound).update({
        status: 'accepted', reviewed_by_email: reviewerEmail, reviewed_at: nowISO(),
      }).eq('id', item.id);
      accepted++;
    }
  }
  return { accepted, duplicates };
}

export async function declineGiLeads(items: GiInboundLead[], reviewerEmail: string, reason: string): Promise<number> {
  const pending = items.filter((i) => i.status === 'pending');
  for (const item of pending) {
    await supabase.from(LIVE_COLLECTIONS.crmInbound).update({
      status: 'declined', decline_reason: reason,
      reviewed_by_email: reviewerEmail, reviewed_at: nowISO(),
    }).eq('id', item.id);
  }
  return pending.length;
}
