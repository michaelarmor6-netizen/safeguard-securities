import { supabase, nowISO } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';

export interface Strategy {
  id: string;
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  targetAllocation: string;
  createdAt?: Date;
}

function mapStrategy(id: string, data: any): Strategy {
  return {
    id,
    name: data.name ?? '',
    description: data.description ?? '',
    riskLevel: data.risk_level ?? data.riskLevel ?? 'medium',
    targetAllocation: data.target_allocation ?? data.targetAllocation ?? '',
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
  };
}

export async function getAllStrategies(): Promise<Strategy[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.strategies)
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => mapStrategy(d.id, d));
}

export async function createStrategy(input: Omit<Strategy, 'id' | 'createdAt'>) {
  return supabase.from(LIVE_COLLECTIONS.strategies).insert({
    name: input.name,
    description: input.description,
    risk_level: input.riskLevel,
    target_allocation: input.targetAllocation,
    created_at: nowISO(),
  });
}

export async function deleteStrategy(id: string) {
  await supabase.from(LIVE_COLLECTIONS.strategies).delete().eq('id', id);
}
