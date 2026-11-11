import { supabase } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';

export interface PortfolioSnapshot {
  date: string; // YYYY-MM-DD
  portfolioValue: number;
  cashBalance: number;
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
}

function mapSnapshot(data: any): PortfolioSnapshot {
  return {
    date: data.date ?? '',
    portfolioValue: Number(data.portfolio_value ?? data.portfolioValue ?? 0),
    cashBalance: Number(data.cash_balance ?? data.cashBalance ?? 0),
    totalValue: Number(data.total_value ?? data.totalValue ?? 0),
    dayChange: Number(data.day_change ?? data.dayChange ?? 0),
    dayChangePercent: Number(data.day_change_percent ?? data.dayChangePercent ?? 0),
  };
}

export async function getPortfolioHistory(userId: string): Promise<PortfolioSnapshot[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.portfolioSnapshots)
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });
  if (error || !data) return [];
  return data.map(mapSnapshot);
}

export async function runPortfolioSnapshotNow() {
  const { data, error } = await supabase.rpc('run_portfolio_snapshot_now');
  if (error) throw error;
  return data;
}
