import { supabase, nowISO } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail?: string;
  subject: string;
  message: string;
  status: 'open' | 'answered' | 'closed';
  adminReply?: string;
  createdAt?: Date;
}

function mapTicket(id: string, data: any): SupportTicket {
  return {
    id,
    userId: data.user_id ?? data.userId ?? '',
    userEmail: data.user_email ?? data.userEmail,
    subject: data.subject ?? '',
    message: data.message ?? '',
    status: data.status ?? 'open',
    adminReply: data.admin_reply ?? data.adminReply,
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
  };
}

export async function getAllTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.supportTickets)
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => mapTicket(d.id, d));
}

export async function getTicketsForUser(userId: string): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.supportTickets)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => mapTicket(d.id, d));
}

export async function createTicket(userId: string, userEmail: string, subject: string, message: string) {
  return supabase.from(LIVE_COLLECTIONS.supportTickets).insert({
    user_id: userId,
    user_email: userEmail,
    subject,
    message,
    status: 'open',
    created_at: nowISO(),
  });
}

export async function replyToTicket(id: string, adminReply: string) {
  await supabase.from(LIVE_COLLECTIONS.supportTickets).update({
    admin_reply: adminReply,
    status: 'answered',
    updated_at: nowISO(),
  }).eq('id', id);
}

export async function closeTicket(id: string) {
  await supabase.from(LIVE_COLLECTIONS.supportTickets).update({
    status: 'closed',
    updated_at: nowISO(),
  }).eq('id', id);
}
