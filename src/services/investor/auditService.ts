import { supabase, nowISO } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  details?: string;
  createdAt?: Date;
}

function mapEntry(id: string, data: any): AuditLogEntry {
  return {
    id,
    actorId: data.actorId ?? '',
    actorEmail: data.actorEmail ?? '',
    action: data.action ?? '',
    details: data.details,
    createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
  };
}

export async function logAction(actorId: string, actorEmail: string, action: string, details?: string) {
  // Best-effort - a logging failure should never block the underlying admin action.
  try {
    await supabase.from(LIVE_COLLECTIONS.auditLogs).insert({
      actor_id: actorId,
      actor_email: actorEmail,
      action,
      details: details ?? null,
      created_at: nowISO(),
    });
  } catch (e) {
    console.error('Failed to write audit log entry:', e);
  }
}

export async function getAuditLog(): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.auditLogs)
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => mapEntry(d.id, d));
}
