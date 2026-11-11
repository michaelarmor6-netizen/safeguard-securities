import { supabase, nowISO } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';

export type AlertCondition = 'above' | 'below';
export type AlertStatus = 'active' | 'triggered' | 'cancelled';

export interface PriceAlert {
  id: string;
  userId: string;
  assetId: string;
  symbol: string;
  condition: AlertCondition;
  targetPrice: number;
  status: AlertStatus;
  seen: boolean;
  createdAt?: Date;
  triggeredAt?: Date;
  triggeredPrice?: number;
}

function mapAlert(id: string, data: any): PriceAlert {
  return {
    id,
    userId: data.user_id ?? data.userId ?? '',
    assetId: data.asset_id ?? data.assetId ?? '',
    symbol: data.symbol ?? '',
    condition: data.condition ?? 'above',
    targetPrice: Number(data.target_price ?? data.targetPrice ?? 0),
    status: data.status ?? 'active',
    seen: Boolean(data.seen ?? true),
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
    triggeredAt: data.triggered_at ? new Date(data.triggered_at) : undefined,
    triggeredPrice: data.triggered_price != null ? Number(data.triggered_price) : undefined,
  };
}

export async function getAlertsForUser(userId: string): Promise<PriceAlert[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.priceAlerts)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => mapAlert(d.id, d));
}

export async function createPriceAlert(input: {
  userId: string;
  assetId: string;
  symbol: string;
  condition: AlertCondition;
  targetPrice: number;
}) {
  await supabase.from(LIVE_COLLECTIONS.priceAlerts).insert({
    user_id: input.userId,
    asset_id: input.assetId,
    symbol: input.symbol.toUpperCase(),
    condition: input.condition,
    target_price: input.targetPrice,
    status: 'active',
    seen: true,
    created_at: nowISO(),
  });
}

export async function cancelPriceAlert(alertId: string) {
  await supabase.from(LIVE_COLLECTIONS.priceAlerts).update({ status: 'cancelled', updated_at: nowISO() }).eq('id', alertId);
}

export async function markAlertSeen(alertId: string) {
  await supabase.from(LIVE_COLLECTIONS.priceAlerts).update({ seen: true, updated_at: nowISO() }).eq('id', alertId);
}

export async function deletePriceAlert(alertId: string) {
  await supabase.from(LIVE_COLLECTIONS.priceAlerts).delete().eq('id', alertId);
}
