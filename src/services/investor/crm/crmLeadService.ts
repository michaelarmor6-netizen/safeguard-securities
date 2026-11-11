// The lead store. After wallets, this becomes the most sensitive collection
// in the app - it is names, numbers and consent records for people who have
// not signed up for anything. Staff-only by RLS, and every bulk
// exit (Vicidial CSV, campaigns later) goes through the audit log.
import { supabase, nowISO } from '../../../config/supabase';
import { LIVE_COLLECTIONS } from '../../../config/liveCollections';
import type { ConsentBasis, CrmLead, CrmLeadSource, CrmLeadStatus, ReviewRow } from './crmTypes';

function mapLead(id: string, data: any): CrmLead {
  return {
    id,
    firstName: data.first_name ?? data.firstName ?? '',
    lastName: data.last_name ?? data.lastName ?? '',
    company: data.company ?? undefined,
    phoneE164: data.phone_e164 ?? data.phoneE164 ?? undefined,
    email: data.email ?? undefined,
    country: data.country ?? undefined,
    tags: Array.isArray(data.tags) ? data.tags : [],
    status: (data.status ?? 'new') as CrmLeadStatus,
    source: data.source ?? { kind: 'manual' },
    consentBasis: (data.consent_basis ?? data.consentBasis ?? 'unknown') as ConsentBasis,
    consentNote: data.consent_note ?? data.consentNote ?? undefined,
    giLeadId: data.gi_lead_id ?? data.giLeadId ?? undefined,
    notes: data.notes ?? undefined,
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
    updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    lastExportedAt: data.last_exported_at ? new Date(data.last_exported_at) : undefined,
  };
}

export interface LeadFilter {
  status?: CrmLeadStatus;
  consentBasis?: ConsentBasis;
  tag?: string;
  hasPhone?: boolean;
  hasEmail?: boolean;
  search?: string; // client-side substring match on name/company/email/phone
}

// RLS keeps reads staff-only; composite-index appetite is kept small: one
// ordered scan (bounded) + client-side filtering. At CRM volumes this is
// simpler and fast enough.
export async function listLeads(filter: LeadFilter = {}, max = 2000): Promise<CrmLead[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.crmLeads)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(max);
  if (error || !data) return [];
  let leads = data.map((d) => mapLead(d.id, d));
  if (filter.status) leads = leads.filter((l) => l.status === filter.status);
  if (filter.consentBasis) leads = leads.filter((l) => l.consentBasis === filter.consentBasis);
  if (filter.tag) leads = leads.filter((l) => l.tags.includes(filter.tag!));
  if (filter.hasPhone) leads = leads.filter((l) => !!l.phoneE164);
  if (filter.hasEmail) leads = leads.filter((l) => !!l.email);
  if (filter.search) {
    const s = filter.search.toLowerCase();
    leads = leads.filter((l) =>
      `${l.firstName} ${l.lastName} ${l.company ?? ''} ${l.email ?? ''} ${l.phoneE164 ?? ''}`.toLowerCase().includes(s));
  }
  return leads;
}

// Which of these phones/emails already exist in the store? Returns value ->
// existing lead id. Used by the review grid so duplicates are decided by a
// person, not silently merged. Supabase 'in' caps at ~30 values, so we chunk.
export async function findExisting(phones: string[], emails: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const lookup = async (field: 'phone_e164' | 'email', values: string[]) => {
    const unique = [...new Set(values.filter(Boolean))];
    for (let i = 0; i < unique.length; i += 30) {
      const chunk = unique.slice(i, i + 30);
      const { data } = await supabase.from(LIVE_COLLECTIONS.crmLeads).select(`${field}, id`).in(field, chunk);
      (data ?? []).forEach((d: any) => found.set(d[field], d.id));
    }
  };
  await lookup('phone_e164', phones);
  await lookup('email', emails);
  return found;
}

// Commit the reviewed rows. Only rows the admin left included, that are not
// suppressed, not duplicates, and problem-free make it in - the caller has
// already shown every exclusion to a human.
export async function commitLeads(
  rows: ReviewRow[],
  source: CrmLeadSource,
  consentBasis: ConsentBasis,
): Promise<number> {
  const eligible = rows.filter((r) =>
    r.include && !r.suppressed && !r.duplicateOfLeadId && !r.duplicateInBatch && r.problems.length === 0);
  // Insert in chunks (no server-side batch; individual inserts are fine at CRM
  // volumes, chunked to keep each request small).
  for (let i = 0; i < eligible.length; i += 450) {
    const chunk = eligible.slice(i, i + 450);
    await supabase.from(LIVE_COLLECTIONS.crmLeads).insert(
      chunk.map((r) => ({
        first_name: r.firstName,
        last_name: r.lastName,
        company: r.company ?? null,
        phone_e164: r.phoneE164 ?? null,
        email: r.email ?? null,
        country: r.country ?? null,
        tags: r.tags,
        status: 'new',
        source,
        consent_basis: consentBasis,
        notes: r.notes ?? null,
        created_at: nowISO(),
        updated_at: nowISO(),
      })),
    );
  }
  return eligible.length;
}

export async function updateLead(id: string, patch: Partial<Pick<CrmLead, 'status' | 'tags' | 'notes' | 'consentNote'>>): Promise<void> {
  await supabase.from(LIVE_COLLECTIONS.crmLeads).update({ ...patch, updated_at: nowISO() }).eq('id', id);
}

export async function deleteLead(id: string): Promise<void> {
  await supabase.from(LIVE_COLLECTIONS.crmLeads).delete().eq('id', id);
}

export async function markExported(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 450) {
    const chunk = ids.slice(i, i + 450);
    await supabase.from(LIVE_COLLECTIONS.crmLeads).update({ last_exported_at: nowISO() }).in('id', chunk);
  }
}
