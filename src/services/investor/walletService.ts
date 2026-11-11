import { supabase, nowISO } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';

export interface InvestorWallet {
  id: string;
  userId: string;
  balance: number;
  currency?: string;
  label?: string;
}

function mapWallet(id: string, data: any): InvestorWallet {
  return {
    id,
    userId: data?.userId ?? '',
    balance: Number(data?.balance ?? 0),
    currency: data?.currency ?? 'USD',
    label: data?.label,
  };
}

export async function getAllWallets(): Promise<InvestorWallet[]> {
  const { data, error } = await supabase.from(LIVE_COLLECTIONS.wallets).select('*');
  if (error || !data) return [];
  return data.map((d) => mapWallet(d.id, d));
}

export async function getUserWallet(userId: string): Promise<InvestorWallet | null> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.wallets)
    .select('*')
    .eq('user_id', userId);
  if (error || !data || data.length === 0) return null;
  return mapWallet(data[0].id, data[0]);
}

export async function createWalletForUser(userId: string) {
  return supabase.from(LIVE_COLLECTIONS.wallets).insert({
    user_id: userId,
    balance: 0,
    currency: 'USD',
    label: 'Primary Wallet',
    status: 'active',
    created_at: nowISO(),
  });
}

// Balances are NOT writable from the browser any more. cashLedger is
// function-only so it can stand as the immutable record of cash. Every credit
// now runs through the confirmFundingReceipt / recordClientDeposit callables,
// which write wallet and ledger in one transaction under a finance role.

// Live balance for the investor Wallet page - updates the moment funding is
// confirmed, without a refresh.
export function watchUserWallet(
  userId: string,
  onChange: (wallet: InvestorWallet | null) => void,
  onError?: (e: Error) => void,
) {
  const channel = supabase
    .channel(`wallet-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: LIVE_COLLECTIONS.wallets,
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const d = payload.new as any;
        onChange(d ? mapWallet(d.id, d) : null);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
