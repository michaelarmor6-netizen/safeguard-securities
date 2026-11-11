import { supabase, nowISO } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';

export type SubPortfolioAssetClass = 'equities' | 'crypto' | 'commodities' | 'managed_strategy';
export type SubPortfolioRiskBand = 'conservative' | 'moderate' | 'aggressive';
export type SubPortfolioStatus = 'active' | 'paused' | 'closed';

export interface SubPortfolio {
  id: string;
  userId: string;
  name: string;
  assetClass: SubPortfolioAssetClass;
  baseCurrency: string;
  targetAllocationPct?: number;
  riskBand?: SubPortfolioRiskBand;
  status: SubPortfolioStatus;
}

export interface SubPortfolioHolding {
  id: string;
  subPortfolioId: string;
  userId: string;
  symbol: string;
  displayName?: string;
  quantity: number;
  avgCost: number;
  markPrice?: number;
  unitLabel: string;
  currency: string;
}

function mapSleeve(id: string, data: any): SubPortfolio {
  return {
    id,
    userId: data.user_id ?? data.userId ?? '',
    name: data.name ?? '',
    assetClass: data.asset_class ?? data.assetClass ?? 'equities',
    baseCurrency: data.base_currency ?? data.baseCurrency ?? 'USD',
    targetAllocationPct: data.target_allocation_pct != null ? Number(data.target_allocation_pct) : undefined,
    riskBand: data.risk_band ?? data.riskBand ?? undefined,
    status: data.status ?? 'active',
  };
}

function mapHolding(id: string, data: any): SubPortfolioHolding {
  return {
    id,
    subPortfolioId: data.sub_portfolio_id ?? data.subPortfolioId ?? '',
    userId: data.user_id ?? data.userId ?? '',
    symbol: data.symbol ?? '',
    displayName: data.display_name ?? data.displayName,
    quantity: Number(data.quantity ?? 0),
    avgCost: Number(data.avg_cost ?? data.avgCost ?? 0),
    markPrice: data.mark_price != null ? Number(data.mark_price) : undefined,
    unitLabel: data.unit_label ?? data.unitLabel ?? 'shares',
    currency: data.currency ?? 'USD',
  };
}

export async function getSubPortfoliosForUser(userId: string): Promise<SubPortfolio[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.subPortfolios)
    .select('*')
    .eq('user_id', userId);
  if (error || !data) return [];
  return data.map((d) => mapSleeve(d.id, d));
}

export async function createSubPortfolio(input: Omit<SubPortfolio, 'id' | 'status'>) {
  return supabase.from(LIVE_COLLECTIONS.subPortfolios).insert({
    user_id: input.userId,
    name: input.name,
    asset_class: input.assetClass,
    base_currency: input.baseCurrency,
    target_allocation_pct: input.targetAllocationPct,
    risk_band: input.riskBand,
    status: 'active',
    created_at: nowISO(),
  });
}

export async function updateSubPortfolio(id: string, patch: Partial<Pick<SubPortfolio, 'name' | 'targetAllocationPct' | 'riskBand' | 'status'>>) {
  await supabase.from(LIVE_COLLECTIONS.subPortfolios).update({ ...patch, updated_at: nowISO() }).eq('id', id);
}

export async function deleteSubPortfolio(id: string) {
  const { data: holdings } = await supabase
    .from(LIVE_COLLECTIONS.subPortfolioHoldings)
    .select('id')
    .eq('sub_portfolio_id', id);
  await Promise.all((holdings ?? []).map((d) => supabase.from(LIVE_COLLECTIONS.subPortfolioHoldings).delete().eq('id', d.id)));
  await supabase.from(LIVE_COLLECTIONS.subPortfolios).delete().eq('id', id);
}

export async function getHoldingsForSleeve(subPortfolioId: string): Promise<SubPortfolioHolding[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.subPortfolioHoldings)
    .select('*')
    .eq('sub_portfolio_id', subPortfolioId);
  if (error || !data) return [];
  return data.map((d) => mapHolding(d.id, d));
}

export async function addHoldingToSleeve(input: Omit<SubPortfolioHolding, 'id'>) {
  const id = `${input.subPortfolioId}_${input.symbol.toUpperCase()}`;
  await supabase.from(LIVE_COLLECTIONS.subPortfolioHoldings).upsert({
    id,
    sub_portfolio_id: input.subPortfolioId,
    user_id: input.userId,
    symbol: input.symbol.toUpperCase(),
    display_name: input.displayName,
    quantity: input.quantity,
    avg_cost: input.avgCost,
    mark_price: input.markPrice,
    unit_label: input.unitLabel,
    currency: input.currency,
    updated_at: nowISO(),
  });
}

export async function updateSleeveHolding(id: string, patch: Partial<Pick<SubPortfolioHolding, 'quantity' | 'avgCost' | 'markPrice'>>) {
  await supabase.from(LIVE_COLLECTIONS.subPortfolioHoldings).update({ ...patch, updated_at: nowISO() }).eq('id', id);
}

export async function deleteSleeveHolding(id: string) {
  await supabase.from(LIVE_COLLECTIONS.subPortfolioHoldings).delete().eq('id', id);
}
