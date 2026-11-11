import { supabase, nowISO } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';

export async function getWatchlistSymbols(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.watchlists)
    .select('symbols')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return [];
  const symbols = data.symbols;
  return Array.isArray(symbols) ? symbols : [];
}

export async function addToWatchlist(userId: string, symbol: string) {
  await supabase
    .from(LIVE_COLLECTIONS.watchlists)
    .upsert({ id: userId, user_id: userId, symbols: [symbol.toUpperCase()], updated_at: nowISO() });
}

export async function removeFromWatchlist(userId: string, symbol: string) {
  // Remove a symbol from the watchlist array. We read the current list then
  // write it back without the removed symbol.
  const { data } = await supabase
    .from(LIVE_COLLECTIONS.watchlists)
    .select('symbols')
    .eq('id', userId)
    .maybeSingle();
  const current: string[] = data?.symbols ?? [];
  const next = current.filter((s) => s !== symbol.toUpperCase());
  await supabase
    .from(LIVE_COLLECTIONS.watchlists)
    .upsert({ id: userId, user_id: userId, symbols: next, updated_at: nowISO() });
}
