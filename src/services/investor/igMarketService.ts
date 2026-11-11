import { supabase } from '../../config/supabase';

export interface IgMarketSnapshot {
  epic: string;
  name: string;
  bid: number | null;
  offer: number | null;
  high: number | null;
  low: number | null;
  netChange: number | null;
  percentageChange: number | null;
  updateTime: string | null;
  marketStatus: string | null;
}

export interface IgCandle {
  time: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
}

export interface IgMarketResult {
  epic: string;
  instrumentName: string;
  instrumentType: string;
  expiry: string;
}

export async function getIgMarketSnapshot(_epic: string): Promise<IgMarketSnapshot> {
  throw new Error('Live market data is paused.');
}

export async function getIgMarketHistory(_epic: string, _resolution = 'MINUTE_5', _max = 100): Promise<IgCandle[]> {
  throw new Error('Live market data is paused.');
}

export async function searchIgMarkets(_searchTerm: string): Promise<IgMarketResult[]> {
  throw new Error('Live market data is paused.');
}
