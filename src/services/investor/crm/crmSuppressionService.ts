// The do-not-contact list. Mirrors the dialer's DNC semantics: checked at
// import AND at every outbound use, because a suppression list consulted
// only once is a suppression list that leaks.
import { supabase, nowISO } from '../../../config/supabase';
import { LIVE_COLLECTIONS } from '../../../config/liveCollections';
import type { CrmSuppressionEntry } from './crmTypes';

function mapEntry(id: string, data: any): CrmSuppressionEntry {
  return {
    id,
    type: data.type ?? 'email',
    value: data.value ?? '',
    reason: data.reason ?? 'manual',
    source: data.source,
    addedAt: data.added_at ? new Date(data.added_at) : undefined,
  };
}

export async function listSuppression(): Promise<CrmSuppressionEntry[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.crmSuppression)
    .select('*')
    .order('added_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => mapEntry(d.id, d));
}

export async function addSuppression(entry: Omit<CrmSuppressionEntry, 'id' | 'addedAt'>): Promise<void> {
  await supabase.from(LIVE_COLLECTIONS.crmSuppression).insert({
    type: entry.type,
    value: entry.value,
    reason: entry.reason,
    source: entry.source,
    added_at: nowISO(),
  });
}

export async function removeSuppression(id: string): Promise<void> {
  await supabase.from(LIVE_COLLECTIONS.crmSuppression).delete().eq('id', id);
}

// Batch membership check. Supabase 'in' caps at 30-ish values per query, so we
// chunk; a 5,000-row import costs ~170 reads here, which is fine.
export async function findSuppressed(values: string[]): Promise<Set<string>> {
  const suppressed = new Set<string>();
  const unique = [...new Set(values.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30);
    const { data, error } = await supabase
      .from(LIVE_COLLECTIONS.crmSuppression)
      .select('value')
      .in('value', chunk);
    if (error || !data) continue;
    data.forEach((d) => suppressed.add(d.value));
  }
  return suppressed;
}
