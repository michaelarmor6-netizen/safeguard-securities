import { supabase, nowISO } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';

export interface StaffNotice {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  invoiceId?: string;
  userId?: string;
  read: boolean;
  createdAt?: Date;
}

function mapNotice(id: string, data: any): StaffNotice {
  return {
    id,
    type: String(data.type ?? ''),
    title: data.title ?? 'Notification',
    body: data.body ?? '',
    href: data.href ?? '/admin/transactions',
    invoiceId: data.invoice_id ?? data.invoiceId,
    userId: data.user_id ?? data.userId,
    read: data.read === true,
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
  };
}

export function subscribeStaffNotices(
  onChange: (rows: StaffNotice[]) => void,
) {
  const channel = supabase
    .channel('staff-notices')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: LIVE_COLLECTIONS.staffNotifications,
      },
      () => {
        getAllStaffNotices().then(onChange).catch(() => onChange([]));
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

async function getAllStaffNotices(): Promise<StaffNotice[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.staffNotifications)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(40);
  if (error || !data) return [];
  return data.map((d) => mapNotice(d.id, d));
}

export async function markStaffNoticeRead(id: string) {
  await supabase.from(LIVE_COLLECTIONS.staffNotifications).update({ read: true, updated_at: nowISO() }).eq('id', id);
}

export async function markAllStaffNoticesRead(rows: StaffNotice[]) {
  await Promise.all(rows.filter((r) => !r.read).map((r) => markStaffNoticeRead(r.id)));
}
