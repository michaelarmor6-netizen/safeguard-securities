import { supabase } from '../../config/supabase';
import { clerkSessionUrl } from '../../lib/clerk';
import { ensureInvestorProfile, type InvestorProfile } from './profileService';

// Clerk holds the password. The Worker verifies the Clerk token and returns a
// Supabase access token for the same email, which we use to establish the
// Supabase session.
export async function connectClerkSession(getToken: () => Promise<string | null>): Promise<InvestorProfile> {
  const url = clerkSessionUrl();
  if (!url) {
    throw new Error('Clerk is on, but the session exchange URL is not configured.');
  }

  const clerkToken = (await getToken()) ?? (await getToken());
  if (!clerkToken) {
    throw new Error('Clerk did not return a session.');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${clerkToken}` },
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; email?: string; error?: unknown };
  if (!res.ok || typeof body.access_token !== 'string') {
    const message = typeof body.error === 'string' ? body.error : 'Could not open your SafeGuard session.';
    throw new Error(message);
  }

  const { error } = await supabase.auth.setSession({
    access_token: body.access_token,
    refresh_token: body.refresh_token ?? '',
  });
  if (error) throw error;

  const email = body.email ?? '';
  if (!email) {
    throw new Error('Signed in, but no email was attached to the account.');
  }

  // Get the user id from the session
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id ?? '';
  if (!uid) {
    throw new Error('Signed in, but no user id was attached to the account.');
  }
  return ensureInvestorProfile(uid, email);
}

export function messageFromClerkError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Could not continue.';
  const record = error as {
    message?: string;
    longMessage?: string;
    errors?: { message?: string; longMessage?: string }[];
  };
  const first = record.errors?.[0];
  return first?.longMessage || first?.message || record.longMessage || record.message || 'Could not continue.';
}
