import { supabase } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';

export interface AiSignalIndicators {
  sma20: number | null;
  sma50: number | null;
  rsi14: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
  lastClose: number;
}

export interface AiSignal {
  id: string;
  symbol: string;
  side: 'buy' | 'sell' | 'hold';
  confidence: number;
  rationale: string;
  indicatorSummary: string;
  indicators: AiSignalIndicators;
  createdAt?: Date;
}

export async function generateSignal(_symbol: string): Promise<AiSignal> {
  throw new Error('Live signals are paused.');
}

function mapSignal(id: string, data: any): AiSignal {
  return {
    id,
    symbol: data.symbol ?? '',
    side: data.side ?? 'hold',
    confidence: Number(data.confidence ?? 0),
    rationale: data.rationale ?? '',
    indicatorSummary: data.indicatorSummary ?? '',
    indicators: data.indicators ?? { sma20: null, sma50: null, rsi14: null, macd: null, lastClose: 0 },
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
  };
}

export async function getSignalHistoryForUser(userId: string): Promise<AiSignal[]> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.aiSignals)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => mapSignal(d.id, d));
}
