import { supabase } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';
import { strikeBelowEntryPrice } from '../../lib/optionValuation';

export interface PlaceOrderPayload {
  userId: string;
  userEmail?: string;
  assetId: string;
  side: 'buy' | 'sell';
  orderType?: 'market' | 'limit' | 'stop' | 'stop_limit';
  timeInForce?: 'day' | 'gtc' | 'ioc' | 'fok';
  quantity: number;
  limitPrice: number;
  stopPrice?: number;
  clientOrderId?: string;
  clientStatus?: 'pending' | 'active' | 'inactive';
  optionType?: 'call' | 'put';
  strikePrice?: number;
  expiryDate?: string;
  contractSize?: number;
  /** Underlying price at entry — P/L reference for limited-risk options. */
  entryUnderlyingPrice?: number;
  deliveryType?: 'cash_settled' | 'physical';
  fees?: number;
  commission?: number;
  subPortfolioId?: string;
  symbolOverride?: string;
}

export interface FillOrderPayload {
  orderId: string;
  quantity: number;
  price: number;
  fees?: number;
  commission?: number;
  optionType?: 'call' | 'put';
  strikePrice?: number;
  expiryDate?: string;
  contractSize?: number;
  /** Underlying price at entry — P/L reference for limited-risk options. */
  entryUnderlyingPrice?: number;
  deliveryType?: 'cash_settled' | 'physical';
  clientStatus?: 'pending' | 'active' | 'inactive';
  brokerExecutionId?: string;
}

export interface FillOrderResult {
  tradeId: string;
  tradeRef: string;
  status: string;
  filledQuantity: number;
  remainingQuantity: number;
}

export interface UpdateTradeContractPayload {
  tradeId: string;
  optionType?: 'call' | 'put' | null;
  strikePrice?: number | null;
  expiryDate?: string | null;
  contractSize?: number | null;
  entryUnderlyingPrice?: number | null;
  clientStatus?: 'pending' | 'active' | 'inactive';
}

export interface StatementRow {
  tradeRef: string;
  status: 'O' | 'C' | 'E';
  executedAt: string | null;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  grossAmount: number;
  fees: number;
  commission: number;
  creditDebit: number;
  remarks: string;
}

export interface StatementResult {
  statementRef: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  rows: StatementRow[];
  summary: { clearedAmount: number; closingBalance: number | null; tradeCount: number };
}

export async function placeOrderOnBehalf(payload: PlaceOrderPayload) {
  const { data, error } = await supabase.rpc('place_order_on_behalf', payload);
  if (error) throw error;
  return data;
}

export async function fillOrder(payload: FillOrderPayload) {
  const { data, error } = await supabase.rpc('fill_order', payload);
  if (error) throw error;
  return data;
}

export async function markOrderWorking(orderId: string) {
  const { error } = await supabase.rpc('mark_order_working', { order_id: orderId });
  if (error) throw error;
}

export async function rejectOrder(orderId: string, reason: string) {
  const { error } = await supabase.rpc('reject_order', { order_id: orderId, reason });
  if (error) throw error;
}

export async function cancelOrder(orderId: string) {
  const { error } = await supabase.rpc('cancel_order', { order_id: orderId });
  if (error) throw error;
}

export async function updateTradeContract(payload: UpdateTradeContractPayload) {
  const { error } = await supabase.rpc('update_trade_contract', payload);
  if (error) throw error;
}

// Entry price lives on the holding and the filled order, not on the trade row.
// Keyed by userId|SYMBOL so the trade editor can show the current entry.
export async function loadPositionEntries(): Promise<Map<string, number>> {
  const [holdingsResp, ordersResp] = await Promise.all([
    supabase.from(LIVE_COLLECTIONS.portfolioHoldings).select('*'),
    supabase.from(LIVE_COLLECTIONS.orders).select('*'),
  ]);
  const entries = new Map<string, number>();
  const take = (userId: unknown, symbol: unknown, entry: unknown) => {
    const price = Number(entry ?? 0);
    const key = `${String(userId ?? '')}|${String(symbol ?? '').trim().toUpperCase()}`;
    if (price > 0 && userId && symbol) entries.set(key, price);
  };
  for (const d of ordersResp.data ?? []) {
    take(d.user_id ?? d.userId, d.symbol, d.entry_underlying_price ?? d.entryUnderlyingPrice);
  }
  for (const d of holdingsResp.data ?? []) {
    take(d.user_id ?? d.userId, d.symbol, d.entry_underlying_price ?? d.entryUnderlyingPrice);
  }
  return entries;
}

// Rewrites the strike and the entry price on an open position. P/L reads the
// strike on the holding, so that document is the one that has to change.
// The filled order and the trade ledger are updated to the same numbers so
// the book does not fall back to the old strike. Quantity, premium, and
// trade value are left as filled.
export async function correctPositionTerms(input: {
  userId: string;
  symbol: string;
  strikePrice: number;
  entryUnderlyingPrice: number;
  tradeId?: string;
  orderId?: string;
}) {
  const symbol = input.symbol.trim().toUpperCase();
  const strikePrice = Number(input.strikePrice);
  const entryUnderlyingPrice = Number(input.entryUnderlyingPrice);
  if (!strikeBelowEntryPrice(strikePrice, entryUnderlyingPrice)) {
    throw new Error(
      `Strike ${strikePrice} has to be lower than the entry price ${entryUnderlyingPrice}. Raise the entry or lower the strike.`,
    );
  }

  const nowISO = new Date().toISOString();
  const terms = { strike_price: strikePrice, entry_underlying_price: entryUnderlyingPrice, updated_at: nowISO };
  const writes: Promise<unknown>[] = [];

  const { data: holdingsResp } = await supabase
    .from(LIVE_COLLECTIONS.portfolioHoldings)
    .select('*')
    .eq('user_id', input.userId);
  const holdings = (holdingsResp ?? []).filter((d) => String(d.symbol ?? '').trim().toUpperCase() === symbol);
  if (holdings.length === 0 && !input.tradeId) {
    throw new Error(`No open ${symbol} position for this client.`);
  }
  for (const holding of holdings) {
    writes.push(
      (async () => {
        await supabase.from(LIVE_COLLECTIONS.portfolioHoldings).update(terms).eq('id', holding.id);
      })(),
    );
  }
  if (input.tradeId) {
    writes.push(
      (async () => {
        await supabase.from(LIVE_COLLECTIONS.trades).update({ ...terms, remarks: 'ADJUSTED' }).eq('id', input.tradeId);
      })(),
    );
  }
  if (input.orderId) {
    writes.push(
      (async () => {
        await supabase.from(LIVE_COLLECTIONS.orders).update(terms).eq('id', input.orderId);
      })(),
    );
  }
  await Promise.all(writes);
}

export async function generateAccountStatement(userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase.rpc('generate_account_statement', { user_id: userId, start_date: startDate, end_date: endDate });
  if (error) throw error;
  return data;
}
