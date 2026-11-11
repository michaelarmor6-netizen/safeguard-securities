import { supabase } from '../../config/supabase';

export interface UnderlyingPriceRow {
  ticker: string;
  price: number;
  priceType?: 'settlement' | 'close' | null;
  asOf?: string | null;
  source?: string | null;
  postedBy?: string | null;
}

export async function listUnderlyingPrices(): Promise<UnderlyingPriceRow[]> {
  const { data, error } = await supabase.from('market_prices').select('*');
  if (error || !data) return [];
  return data.map((d) => ({
    ticker: d.ticker ?? d.id ?? '',
    price: Number(d.price ?? 0),
    priceType: d.price_type ?? null,
    asOf: d.as_of ?? null,
    source: d.source ?? null,
    postedBy: d.posted_by ?? null,
  }));
}

export async function setUnderlyingPriceManually(ticker: string, price: number, asOf: string) {
  const { data, error } = await supabase.rpc('set_underlying_price_manually', { ticker, price, as_of: asOf });
  if (error) throw error;
  return data;
}

export async function refreshUnderlyingPricesNow() {
  const { data, error } = await supabase.rpc('run_underlying_price_refresh_now');
  if (error) throw error;
  return data;
}
