import { supabase, nowISO } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';

export type ClientNoticeType = 'invoice';

export interface ClientNotice {
  id: string;
  userId: string;
  type: ClientNoticeType;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt?: Date;
}

function mapNotice(id: string, data: any): ClientNotice {
  return {
    id,
    userId: data.user_id ?? data.userId ?? '',
    type: data.type === 'invoice' ? 'invoice' : 'invoice',
    title: data.title ?? 'Notification',
    body: data.body ?? '',
    href: data.href ?? '/workspace/invoices',
    read: data.read === true,
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
  };
}

export async function getNoticesForUser(userId: string): Promise<ClientNotice[]> {
  try {
    const { data, error } = await supabase
      .from(LIVE_COLLECTIONS.clientNotifications)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) throw error;
    return (data ?? []).map((d) => mapNotice(d.id, d));
  } catch {
    const { data } = await supabase.from(LIVE_COLLECTIONS.clientNotifications).select('*').eq('user_id', userId).limit(40);
    return (data ?? [])
      .map((d) => mapNotice(d.id, d))
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }
}

export function subscribeNoticesForUser(
  userId: string,
  onChange: (rows: ClientNotice[]) => void,
) {
  const channel = supabase
    .channel(`notices-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: LIVE_COLLECTIONS.clientNotifications,
        filter: `user_id=eq.${userId}`,
      },
      () => {
        getNoticesForUser(userId).then(onChange).catch(() => onChange([]));
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function markNoticeRead(id: string) {
  await supabase.from(LIVE_COLLECTIONS.clientNotifications).update({ read: true, updated_at: nowISO() }).eq('id', id);
}

export async function markAllNoticesRead(rows: ClientNotice[]) {
  await Promise.all(rows.filter((r) => !r.read).map((r) => markNoticeRead(r.id)));
}
