import { supabase, nowISO } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';

// Kept in sync with the Asset Type list in Settings -> Trading Configuration
// (AdminTradingConfigSection.tsx) - an instrument added there under any of
// these types must also be selectable in Trade Entry, or it's uncatalogable
// once created.
export type AssetClass =
  | 'commodity_future'
  | 'equity'
  | 'etf'
  | 'benchmark_index'
  | 'fx'
  | 'crypto'
  | 'option'
  | 'warrant'
  | 'bond'
  | 'other';
export type AssetPriority = 'core' | 'extended';

// Single source of truth for "which asset classes exist" - every UI that
// offers a class/type picker (Trade Entry, Asset Management, Settings ->
// Trading Configuration) should derive its options from this array so they
// can't silently drift out of sync with each other again.
export const ASSET_CLASSES: AssetClass[] = [
  'commodity_future',
  'equity',
  'etf',
  'benchmark_index',
  'fx',
  'crypto',
  'option',
  'warrant',
  'bond',
  'other',
];

export interface AssetGroup {
  id: string;
  label: string;
  assetClass: AssetClass;
  parentLabel: string;
  sortOrder: number;
  description?: string;
}

export interface AssetQuote {
  price: number;
  change: number;
  changePercent: number;
  fetchedAt?: Date;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  groupId: string;
  exchange?: string;
  sector?: string;
  contractUnit?: string;
  priority: AssetPriority;
  quoteSymbol: string | null;
  underlyingPriceSymbol: string | null;
  dataProvider: 'finnhub';
  quote?: AssetQuote;
  isTradable: boolean;
  isActive: boolean;
  sortOrder?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

function mapGroup(id: string, data: any): AssetGroup {
  return {
    id,
    label: data.label,
    assetClass: data.assetClass,
    parentLabel: data.parentLabel,
    sortOrder: data.sortOrder ?? 0,
    description: data.description,
  };
}

function mapAsset(id: string, data: any): Asset {
  return {
    id,
    symbol: data.symbol,
    name: data.name,
    assetClass: data.assetClass,
    groupId: data.groupId,
    exchange: data.exchange,
    sector: data.sector,
    contractUnit: data.contractUnit,
    priority: data.priority ?? 'core',
    quoteSymbol: data.quoteSymbol ?? null,
    underlyingPriceSymbol: data.underlyingPriceSymbol ?? null,
    dataProvider: data.dataProvider ?? 'finnhub',
    quote: data.quote
      ? {
          price: data.quote.price,
          change: data.quote.change,
          changePercent: data.quote.changePercent,
          fetchedAt: data.quote.fetchedAt ? new Date(data.quote.fetchedAt) : undefined,
        }
      : undefined,
    isTradable: Boolean(data.isTradable),
    isActive: data.isActive ?? true,
    sortOrder: data.sortOrder,
    createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
  };
}

export async function getAssetGroups(assetClass?: AssetClass): Promise<AssetGroup[]> {
  let q = supabase.from(LIVE_COLLECTIONS.assetGroups).select('*').order('sort_order', { ascending: true });
  if (assetClass) {
    q = supabase.from(LIVE_COLLECTIONS.assetGroups).select('*').eq('asset_class', assetClass).order('sort_order', { ascending: true });
  }
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((d) => mapGroup(d.id, d));
}

export async function getAllAssets(assetClass?: AssetClass): Promise<Asset[]> {
  let q = supabase.from(LIVE_COLLECTIONS.assets).select('*').eq('is_active', true);
  if (assetClass) {
    q = supabase.from(LIVE_COLLECTIONS.assets).select('*').eq('asset_class', assetClass).eq('is_active', true);
  }
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((d) => mapAsset(d.id, d));
}

export async function getAssetsByGroup(groupId: string): Promise<Asset[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.assets)
    .select('*')
    .eq('group_id', groupId)
    .eq('is_active', true);
  if (error || !data) return [];
  return data.map((d) => mapAsset(d.id, d));
}

export function searchAssets(assets: Asset[], query: string): Asset[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return assets;
  return assets.filter(
    (a) => a.symbol.toLowerCase().includes(needle) || a.name.toLowerCase().includes(needle),
  );
}

export function subscribeToAsset(symbol: string, cb: (asset: Asset | null) => void) {
  const channel = supabase
    .channel(`asset-${symbol}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: LIVE_COLLECTIONS.assets,
        filter: `id=eq.${symbol}`,
      },
      (payload) => {
        const d = payload.new as any;
        cb(d ? mapAsset(d.id, d) : null);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Admin catalog management
export async function createOrUpdateAsset(asset: Omit<Asset, 'quote' | 'createdAt' | 'updatedAt'>) {
  const { data: existing } = await supabase
    .from(LIVE_COLLECTIONS.assets)
    .select('*')
    .eq('id', asset.id)
    .maybeSingle();
  await supabase.from(LIVE_COLLECTIONS.assets).upsert({
    ...asset,
    updated_at: nowISO(),
    ...(existing ? {} : { created_at: nowISO() }),
  });
}

export async function setAssetTradable(id: string, isTradable: boolean) {
  await supabase.from(LIVE_COLLECTIONS.assets).update({ is_tradable: isTradable, updated_at: nowISO() }).eq('id', id);
}

export async function setAssetActive(id: string, isActive: boolean) {
  await supabase.from(LIVE_COLLECTIONS.assets).update({ is_active: isActive, updated_at: nowISO() }).eq('id', id);
}

export async function refreshAssetQuote(_symbol: string): Promise<{ symbol: string; price: number; change: number; changePercent: number }> {
  throw new Error('Live quotes are paused.');
}
