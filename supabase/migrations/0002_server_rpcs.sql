-- ============================================================================
-- Safeguard Securities — server RPCs (Phase 2: completing the trading loop)
--
-- Implements the functions referenced by src/services/investor/*.ts:
--   funding:   confirm_funding_receipt, record_client_deposit,
--              backfill_deposit_ledger
--   trading:   place_order_on_behalf, fill_order, mark_order_working,
--              reject_order, cancel_order, update_trade_contract,
--              generate_account_statement
--   admin:     create_investor_account, create_staff_account,
--              check_email_available
--   marks:     set_underlying_price_manually, run_underlying_price_refresh_now
--   charts:    run_portfolio_snapshot_now
--
-- Param names match the EXACT keys the services pass to supabase.rpc().
-- camelCase params are quoted Postgres identifiers (PostgREST maps named
-- args as-is, case-sensitively). Because many camelCase params collide with
-- the generated camel mirror columns of the same name (e.g. "clientStatus"
-- exists both as a param and as a physical generated column on adminOrders),
-- every such function sets #variable_conflict use_variable: unqualified names
-- resolve to the parameter, and real column references are always qualified
-- (o.x, h.x, a.x, mp.x).
--
-- All admin RPCs are SECURITY DEFINER and internally gated on
-- investor_is_staff() (from 0001).
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================= tables

-- Underlying marks posted by the desk (Admin -> Underlying Prices).
create table if not exists "market_prices" (
  id          uuid primary key default gen_random_uuid(),
  ticker      text not null unique,
  price       numeric not null default 0,
  price_type  text,                                   -- 'settlement' | 'close' | 'manual'
  as_of       timestamptz,
  source      text default 'manual',
  posted_by   text,
  created_at  timestamptz default now(),
  updated_at  timestamptz
);

-- Immutable cash record. Written ONLY by these RPCs (never from the browser).
create table if not exists "cashLedger" (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  type        text not null check (type in ('deposit', 'trade', 'adjustment', 'withdrawal')),
  amount      numeric not null,                       -- signed: + credit, - debit
  reference   text,
  note        text,
  created_by  text,
  created_at  timestamptz default now()
);
create index if not exists cash_ledger_user_idx on "cashLedger" (user_id, created_at desc);

alter table "market_prices" enable row level security;
alter table "cashLedger"    enable row level security;

drop policy if exists market_prices_staff on "market_prices";
create policy market_prices_staff on "market_prices" for all to authenticated
  using (public.investor_is_staff()) with check (public.investor_is_staff());
-- cashLedger: no policy = no direct access; RPCs run as definer.

-- profiles needs idNumber for the admin-created account flow
alter table "profiles" add column if not exists "idNumber" text;

-- ============================================================= helpers

-- Desk/trade reference: SG-T-XXXXXXXX / SG-ST-XXXXXXXX style.
create or replace function public.sg_ref(prefix text, len int default 8)
returns text language sql volatile as $$
  select prefix || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, len));
$$;

-- Bumped shared counters (mirrors the counters table the browser uses).
create or replace function public.sg_next_counter(counter text)
returns integer language plpgsql volatile as $$
declare
  v integer;
begin
  insert into "counters" (id, value) values (counter, 1)
  on conflict (id) do update set value = "counters".value + 1
  returning value into v;
  return v;
end $$;

-- Credits (or creates) a client wallet, returning previous + new balance.
create or replace function public.sg_credit_wallet(p_user uuid, p_amount numeric)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  prev numeric;
  newb numeric;
begin
  select balance into prev from "wallets" where user_id = p_user for update;
  if prev is null then
    insert into "wallets" (user_id, balance, currency, label, status)
    values (p_user, p_amount, 'USD', 'Primary Wallet', 'active');
    prev := 0;
    newb := p_amount;
  else
    newb := prev + p_amount;
    update "wallets" set balance = newb, updated_at = now() where user_id = p_user;
  end if;
  return jsonb_build_object('previousBalance', prev, 'newBalance', newb);
end $$;

-- ============================================================= funding RPCs

-- Finance confirms the wire arrived: request -> funded, wallet credited.
create or replace function public.confirm_funding_receipt(request_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  req "fundingRequests"%rowtype;
  credited jsonb;
begin
  if not public.investor_is_staff() then
    raise exception 'Staff only.';
  end if;
  select * into req from "fundingRequests" where id = request_id;
  if req.id is null then raise exception 'Funding request not found.'; end if;
  if req.status <> 'approved' or req.awaiting_payment is not true then
    raise exception 'Only approved requests awaiting payment can be marked funded.';
  end if;

  update "fundingRequests"
     set status = 'funded', awaiting_payment = false,
         funded_at = now(), updated_at = now()
   where id = request_id;

  credited := public.sg_credit_wallet(req.user_id, req.amount);

  insert into "cashLedger" (user_id, type, amount, reference, note, created_by)
  values (req.user_id, 'deposit', req.amount, req.reference, 'Funding confirmed', auth.uid()::text);

  insert into "clientNotifications" (user_id, type, title, body, href)
  values (req.user_id, 'funding', 'Funding confirmed',
          'Your funding of $' || req.amount::text || ' has been credited to your wallet.',
          '/workspace/wallet');

  return jsonb_build_object('new_balance', (credited->>'newBalance')::numeric);
end $$;

-- Admin top-up: creates a funded funding request and credits the wallet.
create or replace function public.record_client_deposit(
  user_id uuid, user_email text default null, amount numeric default null, note text default null
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_variable
declare
  amt numeric;
  rid uuid;
  ref text;
  n integer;
  credited jsonb;
begin
  if not public.investor_is_staff() then
    raise exception 'Staff only.';
  end if;
  amt := coalesce(amount, 0);
  if amt <= 0 then
    raise exception 'Enter an amount greater than zero.';
  end if;

  n := public.sg_next_counter('funding-' || to_char(now(), 'YYYY'));
  ref := 'SG-FUND' || to_char(now(), 'YY') || lpad(n::text, 5, '0');

  insert into "fundingRequests" (user_id, user_email, amount, status, reference,
                                 funded_at, source, note, recorded_by_email, recorded_by_uid,
                                 created_at, updated_at)
  values (user_id, user_email, amt, 'funded', ref, now(), 'admin', note,
          auth.email(), auth.uid(), now(), now())
  returning id into rid;

  credited := public.sg_credit_wallet(user_id, amt);

  insert into "cashLedger" (user_id, type, amount, reference, note, created_by)
  values (user_id, 'deposit', amt, ref, coalesce(note, 'Admin top-up'), auth.uid()::text);

  insert into "clientNotifications" (user_id, type, title, body, href)
  values (user_id, 'funding', 'Wallet credited',
          'A deposit of $' || amt::text || ' was credited to your wallet.', '/workspace/wallet');

  return jsonb_build_object(
    'requestId', rid, 'reference', ref, 'amount', amt,
    'previousBalance', credited->>'previousBalance',
    'newBalance', credited->>'newBalance'
  );
end $$;

-- Replays ledger entries for deposits credited before the ledger existed.
create or replace function public.backfill_deposit_ledger(user_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  inserted integer;
begin
  if not public.investor_is_staff() then
    raise exception 'Staff only.';
  end if;
  with ins as (
    insert into "cashLedger" (user_id, type, amount, reference, note, created_by)
    select f.user_id, 'deposit', f.amount, f.reference, 'Backfill of ' || f.status,
           auth.uid()::text
      from "fundingRequests" f
     where f.user_id = backfill_deposit_ledger.user_id
       and f.status = 'funded'
       and f.reference is not null
       and not exists (
            select 1 from "cashLedger" c
             where c.user_id = f.user_id and c.reference = f.reference and c.type = 'deposit')
    returning 1
  )
  select count(*) into inserted from ins;
  return jsonb_build_object('inserted', inserted);
end $$;

-- ============================================================= trading RPCs

-- Desk places an order on behalf of a client. Param names = PlaceOrderPayload keys.
create or replace function public.place_order_on_behalf(
  "userId" uuid,
  "assetId" text default null,
  side text default 'buy',
  "orderType" text default 'market',
  "timeInForce" text default 'day',
  quantity numeric default null,
  "limitPrice" numeric default null,
  "stopPrice" numeric default null,
  "clientOrderId" text default null,
  "clientStatus" text default 'pending',
  "optionType" text default null,
  "strikePrice" numeric default null,
  "expiryDate" text default null,
  "contractSize" numeric default null,
  "entryUnderlyingPrice" numeric default null,
  "deliveryType" text default null,
  fees numeric default 0,
  commission numeric default 0,
  "subPortfolioId" uuid default null,
  "symbolOverride" text default null
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_variable
declare
  v_asset text;
  v_id uuid;
begin
  if not public.investor_is_staff() then
    raise exception 'Staff only.';
  end if;
  if quantity is null or quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;
  if side not in ('buy', 'sell') then
    raise exception 'Side must be buy or sell.';
  end if;

  -- resolve display symbol: override wins, else the catalog symbol for the asset
  if "symbolOverride" is not null and btrim("symbolOverride") <> '' then
    v_asset := upper(btrim("symbolOverride"));
  else
    select upper(btrim(a.symbol)) into v_asset
      from "assets" a where a.id = "assetId";
    v_asset := coalesce(v_asset, upper(btrim("assetId")));
  end if;

  insert into "adminOrders" (
    user_id, user_email, asset_id, symbol, side, order_type, time_in_force,
    quantity, limit_price, stop_price, client_status, status,
    option_type, strike_price, expiry_date, contract_size, entry_underlying_price,
    delivery_type, fees, commission, sub_portfolio_id, created_at
  ) values (
    "userId", (select p."email"::text from "profiles" p where p.id = "userId"),
    "assetId", v_asset, side,
    "orderType", "timeInForce", quantity, "limitPrice", "stopPrice", "clientStatus", 'pending',
    "optionType", "strikePrice", "expiryDate", "contractSize", "entryUnderlyingPrice",
    "deliveryType", fees, commission, "subPortfolioId", now()
  ) returning id into v_id;

  insert into "auditLogs" (actor_id, actor_email, action, details, created_at)
  values (auth.uid(), auth.email(), 'place_order_on_behalf',
          v_asset || ' ' || side || ' x' || quantity::text || ' for ' || "userId"::text, now());

  return jsonb_build_object('orderId', v_id, 'symbol', v_asset, 'status', 'pending');
end $$;

-- Fill (fully or partially) an order: trade ledger + holding + wallet cash leg.
create or replace function public.fill_order(
  "orderId" uuid,
  quantity numeric default null,
  price numeric default null,
  fees numeric default 0,
  commission numeric default 0,
  "optionType" text default null,
  "strikePrice" numeric default null,
  "expiryDate" text default null,
  "contractSize" numeric default null,
  "entryUnderlyingPrice" numeric default null,
  "deliveryType" text default null,
  "clientStatus" text default null,
  "brokerExecutionId" text default null
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_variable
declare
  o record;
  fill_qty numeric;
  fill_price numeric;
  remaining numeric;
  new_filled numeric;
  tid uuid;
  tref text;
  h record;
  cash numeric;
  new_avg numeric;
begin
  if not public.investor_is_staff() then
    raise exception 'Staff only.';
  end if;
  select * into o from "adminOrders" where id = "orderId" for update;
  if o.id is null then raise exception 'Order not found.'; end if;
  if o.status in ('filled', 'cancelled', 'rejected', 'expired') then
    raise exception 'Order is already %.', o.status;
  end if;
  fill_qty := coalesce(quantity, o.quantity - o.filled_quantity);
  if fill_qty <= 0 then raise exception 'Fill quantity must be greater than zero.'; end if;
  fill_price := coalesce(price, o.limit_price, o.price, 0);
  if fill_price <= 0 then raise exception 'Fill price must be greater than zero.'; end if;

  new_filled := o.filled_quantity + fill_qty;
  remaining := greatest(o.quantity - new_filled, 0);

  if new_filled >= o.quantity then
    update "adminOrders"
       set status = 'filled', filled_quantity = new_filled, avg_fill_price = fill_price,
           price = fill_price, filled_at = now(), updated_at = now(),
           client_status = coalesce("clientStatus", o.client_status),
           option_type = coalesce("optionType", o.option_type),
           strike_price = coalesce("strikePrice", o.strike_price),
           expiry_date = coalesce("expiryDate", o.expiry_date),
           contract_size = coalesce("contractSize", o.contract_size),
           entry_underlying_price = coalesce("entryUnderlyingPrice", o.entry_underlying_price),
           delivery_type = coalesce("deliveryType", o.delivery_type),
           fees = o.fees + fees, commission = o.commission + commission
     where id = "orderId";
  else
    update "adminOrders"
       set status = 'partially_filled', filled_quantity = new_filled, avg_fill_price = fill_price,
           price = fill_price, updated_at = now(),
           client_status = coalesce("clientStatus", o.client_status),
           option_type = coalesce("optionType", o.option_type),
           strike_price = coalesce("strikePrice", o.strike_price),
           expiry_date = coalesce("expiryDate", o.expiry_date),
           contract_size = coalesce("contractSize", o.contract_size),
           entry_underlying_price = coalesce("entryUnderlyingPrice", o.entry_underlying_price),
           delivery_type = coalesce("deliveryType", o.delivery_type),
           fees = o.fees + fees, commission = o.commission + commission
     where id = "orderId";
  end if;

  -- trade ledger row (broker execution id lives on trades, not adminOrders)
  tref := public.sg_ref('SG-T-', 8);
  insert into "trades" (
    trade_ref, order_id, user_id, user_email, asset_id, sub_portfolio_id,
    symbol, side, quantity, price, gross_amount, fees, commission, currency,
    executed_at, remarks, client_status, option_type, strike_price,
    entry_underlying_price, expiry_date, contract_size, broker_execution_id,
    updated_at
  ) values (
    tref, "orderId", o.user_id, o.user_email, o.asset_id, o.sub_portfolio_id,
    o.symbol, o.side, fill_qty, fill_price, fill_price * fill_qty, fees, commission, 'USD',
    now(), case when remaining > 0 then 'PARTIALLY_FILLED' else 'OPEN' end,
    coalesce("clientStatus", o.client_status),
    coalesce("optionType", o.option_type),
    coalesce("strikePrice", o.strike_price),
    coalesce("entryUnderlyingPrice", o.entry_underlying_price),
    coalesce("expiryDate", o.expiry_date),
    coalesce("contractSize", o.contract_size),
    "brokerExecutionId", now()
  ) returning id into tid;

  -- cash leg
  cash := fill_price * fill_qty;
  if o.side = 'buy' then
    cash := -(cash + fees + commission);
  else
    cash := cash - fees - commission;
  end if;
  update "wallets"
     set balance = balance + cash, updated_at = now()
   where user_id = o.user_id;
  insert into "cashLedger" (user_id, type, amount, reference, note, created_by)
  values (o.user_id, 'trade', cash, tref, o.side || ' ' || o.symbol || ' x' || fill_qty::text,
          auth.uid()::text);

  -- holdings leg (physical columns are camelCase: "shares"/"avgCost"/"currentPrice")
  select * into h from "portfolioHoldings"
   where user_id = o.user_id and upper(btrim(symbol)) = upper(btrim(o.symbol))
   limit 1;
  if o.side = 'buy' then
    if h.id is null then
      insert into "portfolioHoldings" (
        user_id, symbol, "name", "shares", "avgCost", "currentPrice", "assetId",
        "optionType", strike_price, entry_underlying_price, "multiplier", "contractSize", updated_at
      ) values (
        o.user_id, upper(btrim(o.symbol)), upper(btrim(o.symbol)),
        fill_qty, fill_price, fill_price, o.asset_id,
        coalesce("optionType", o.option_type),
        coalesce("strikePrice", o.strike_price),
        coalesce("entryUnderlyingPrice", o.entry_underlying_price),
        coalesce("contractSize", o.contract_size),
        coalesce("contractSize", o.contract_size),
        now()
      );
    else
      new_avg := ((coalesce(h."avgCost", 0) * coalesce(h."shares", 0)) + (fill_price * fill_qty))
                 / (coalesce(h."shares", 0) + fill_qty);
      update "portfolioHoldings"
         set "shares" = coalesce(h."shares", 0) + fill_qty,
             "avgCost" = new_avg,
             "currentPrice" = fill_price,
             "optionType" = coalesce("optionType", h."optionType"),
             strike_price = coalesce("strikePrice", h.strike_price),
             entry_underlying_price = coalesce("entryUnderlyingPrice", h.entry_underlying_price),
             "multiplier" = coalesce(h."multiplier", "contractSize", o.contract_size),
             "contractSize" = coalesce("contractSize", h."contractSize"),
             updated_at = now()
       where id = h.id;
    end if;
  else
    -- sell: reduce or close the position
    if h.id is not null then
      if coalesce(h."shares", 0) - fill_qty <= 0 then
        delete from "portfolioHoldings" where id = h.id;
      else
        update "portfolioHoldings"
           set "shares" = coalesce(h."shares", 0) - fill_qty,
               "currentPrice" = fill_price,
               updated_at = now()
         where id = h.id;
      end if;
    end if;
  end if;

  insert into "staffNotifications" (type, title, body, href, user_id)
  values ('trade-fill', 'Order filled',
          o.symbol || ' ' || o.side || ' x' || fill_qty::text || ' @ ' || fill_price::text,
          '/admin/orders', o.user_id);

  return jsonb_build_object(
    'tradeId', tid, 'tradeRef', tref,
    'status', case when remaining > 0 then 'partially_filled' else 'filled' end,
    'filledQuantity', fill_qty, 'remainingQuantity', remaining
  );
end $$;

create or replace function public.mark_order_working(order_id uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.investor_is_staff() then raise exception 'Staff only.'; end if;
  update "adminOrders"
     set status = 'working', updated_at = now()
   where id = order_id and status = 'pending';
end $$;

create or replace function public.reject_order(order_id uuid, reason text default '')
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.investor_is_staff() then raise exception 'Staff only.'; end if;
  update "adminOrders"
     set status = 'rejected', rejection_reason = reason, updated_at = now(),
         cancelled_at = now()
   where id = order_id;
end $$;

create or replace function public.cancel_order(order_id uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  o record;
begin
  if not public.investor_is_staff() then raise exception 'Staff only.'; end if;
  select * into o from "adminOrders" where id = order_id;
  if o.id is null then raise exception 'Order not found.'; end if;
  if o.status not in ('pending', 'working') then
    raise exception 'Only pending or working orders can be cancelled.';
  end if;
  update "adminOrders"
     set status = 'cancelled', cancelled_at = now(), updated_at = now()
   where id = order_id;
end $$;

create or replace function public.update_trade_contract(
  "tradeId" uuid,
  "optionType" text default null,
  "strikePrice" numeric default null,
  "expiryDate" text default null,
  "contractSize" numeric default null,
  "entryUnderlyingPrice" numeric default null,
  "clientStatus" text default null
)
returns void
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_variable
begin
  if not public.investor_is_staff() then raise exception 'Staff only.'; end if;
  update "trades"
     set "optionType" = coalesce("optionType", t."optionType"),
         strike_price = coalesce("strikePrice", t.strike_price),
         expiry_date = coalesce("expiryDate", t.expiry_date),
         contract_size = coalesce("contractSize", t.contract_size),
         entry_underlying_price = coalesce("entryUnderlyingPrice", t.entry_underlying_price),
         client_status = coalesce("clientStatus", t.client_status),
         updated_at = now()
   from "trades" t
   where t.id = "tradeId";
end $$;

-- Statement of fills for a period (Admin -> Statements).
create or replace function public.generate_account_statement(
  user_id uuid, start_date date default null, end_date date default null
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  d_from date := coalesce(start_date, (current_date - interval '30 days')::date);
  d_to date := coalesce(end_date, current_date);
  rows jsonb;
  n integer;
  cleared numeric;
  bal numeric;
begin
  if not public.investor_is_staff() then raise exception 'Staff only.'; end if;
  select coalesce(jsonb_agg(rowj order by executed_at), '[]'::jsonb) into rows
    from (
      select jsonb_build_object(
        'tradeRef', trade_ref,
        'status', case remarks when 'OPEN' then 'O' when 'CLOSED' then 'C' else 'E' end,
        'executedAt', executed_at,
        'symbol', symbol, 'side', side,
        'quantity', quantity, 'price', price,
        'grossAmount', gross_amount, 'fees', fees, 'commission', commission,
        'creditDebit', case when side = 'buy'
                            then -(gross_amount + fees + commission)
                            else (gross_amount - fees - commission) end,
        'remarks', remarks
      ) as rowj
      from "trades"
      where trades.user_id = generate_account_statement.user_id
        and executed_at::date between d_from and d_to
    ) s;
  select coalesce(sum((r->>'creditDebit')::numeric), 0) into cleared
    from jsonb_array_elements(rows) r;
  select balance into bal from "wallets" where user_id = generate_account_statement.user_id;
  select jsonb_array_length(rows) into n;
  return jsonb_build_object(
    'statementRef', public.sg_ref('SG-ST-', 8),
    'userId', user_id,
    'periodStart', d_from, 'periodEnd', d_to,
    'rows', rows,
    'summary', jsonb_build_object(
      'clearedAmount', cleared, 'closingBalance', bal, 'tradeCount', n
    )
  );
end $$;

-- ============================================================= performance

-- Daily snapshot for every active/pending profile (Admin -> Performance, and
-- run_portfolio_snapshot_now from the client Performance page).
create or replace function public.run_portfolio_snapshot_now()
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  n integer;
begin
  with vals as (
    select p.id as user_id,
           coalesce((select sum(h."shares" * coalesce(h."currentPrice", h."avgCost", 0))
                     from "portfolioHoldings" h where h.user_id = p.id), 0) as pv,
           coalesce((select w.balance from "wallets" w where w.user_id = p.id), 0) as cash
      from "profiles" p
     where p."accountStatus" in ('active', 'pending')
  ),
  upserted as (
    insert into "portfolioSnapshots" (user_id, date, portfolio_value, cash_balance, total_value,
                                      day_change, day_change_percent)
    select v.user_id, current_date, v.pv, v.cash, v.pv + v.cash,
           (v.pv + v.cash) - coalesce(y.total_value, 0),
           case when coalesce(y.total_value, 0) > 0
                then ((v.pv + v.cash) - y.total_value) / y.total_value * 100
                else 0 end
      from vals v
      left join "portfolioSnapshots" y
        on y.user_id = v.user_id and y.date = current_date - 1
    on conflict (user_id, date) do update
      set portfolio_value = excluded.portfolio_value,
          cash_balance = excluded.cash_balance,
          total_value = excluded.total_value,
          day_change = excluded.day_change,
          day_change_percent = excluded.day_change_percent
    returning 1
  )
  select count(*) into n from upserted;
  return jsonb_build_object('snapshots', n, 'date', current_date);
end $$;

-- ============================================================= marks

-- Desk posts an underlying mark (Admin -> Underlying Prices), then marks are
-- fanned out into assets.quote so watchlist/portfolio/quotes render.
create or replace function public.set_underlying_price_manually(
  ticker text, price numeric, as_of timestamptz default null
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_variable
declare
  t text := upper(btrim(ticker));
  updated integer;
begin
  if not public.investor_is_staff() then raise exception 'Staff only.'; end if;
  if price is null or price <= 0 then raise exception 'Enter a price greater than zero.'; end if;
  -- update-then-insert instead of ON CONFLICT (ticker): with
  -- #variable_conflict use_variable, the conflict target `ticker` would be
  -- substituted with the PARAMETER value, breaking the index inference (42P10).
  -- RHS names below resolve to the parameters (that is what we want).
  update "market_prices"
     set price = price, price_type = 'manual', as_of = coalesce(as_of, now()),
         source = 'manual', posted_by = auth.email(), updated_at = now()
   where market_prices.ticker = t;
  get diagnostics updated = row_count;
  if updated = 0 then
    insert into "market_prices" (ticker, price, price_type, as_of, source, posted_by,
                                 created_at, updated_at)
    values (t, price, 'manual', coalesce(as_of, now()), 'manual', auth.email(), now(), now());
  end if;
  return public.run_underlying_price_refresh_now();
end $$;

-- Copies desk-posted marks into assets.quote so the watchlist/quotes render.
create or replace function public.run_underlying_price_refresh_now()
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  n integer;
begin
  if not public.investor_is_staff() then raise exception 'Staff only.'; end if;
  with updated as (
    update "assets" a
       set "quote" = jsonb_build_object(
              'price', mp.price, 'change', 0, 'changePercent', 0, 'fetchedAt', now()),
           updated_at = now()
      from "market_prices" mp
     where a.symbol = mp.ticker
        or a.id = mp.ticker
        or mp.ticker like upper(a.symbol) || '%'
    returning 1
  )
  select count(*) into n from updated;
  return jsonb_build_object('updated', n, 'at', now());
end $$;

-- ============================================================= account creation

create or replace function public.check_email_available(email text)
returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
#variable_conflict use_variable
declare
  taken boolean;
begin
  select exists(
           select 1 from auth.users u where lower(u.email) = lower(email)
         )
      or exists(
           select 1 from "profiles" p where lower(p."email") = lower(email)
         )
    into taken;
  return jsonb_build_object('available', not taken);
end $$;

-- Shared helper: provision a GoTrue user row + identity for admin-created accounts.
create or replace function public.sg_provision_auth_user(
  p_email text, p_temp_password text, p_meta jsonb
)
returns uuid
language plpgsql volatile security definer set search_path = public, auth as $$
declare
  v_uid uuid;
begin
  v_uid := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', lower(btrim(p_email)),
    crypt(p_temp_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    p_meta,
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    'email', v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', lower(btrim(p_email)), 'email_verified', false),
    'email', now(), now(), now()
  );
  return v_uid;
end $$;

-- Admin creates a full client account (auth user + profile + wallet).
create or replace function public.create_investor_account(
  email text,
  "firstName" text default '',
  "middleName" text default null,
  "lastName" text default '',
  "dateOfBirth" text default null,
  gender text default null,
  phone text default null,
  address jsonb default null,
  citizenship text default null,
  "residencyCountry" text default null,
  "idType" text default null,
  "idNumber" text default null,
  employment jsonb default null,
  "investmentProfile" jsonb default null,
  compliance jsonb default null,
  "accountManager" jsonb default null
)
returns jsonb
language plpgsql volatile security definer set search_path = public, auth as $$
#variable_conflict use_variable
declare
  v_uid uuid;
  v_temp text;
begin
  if not public.investor_is_staff() then raise exception 'Staff only.'; end if;
  if not (public.check_email_available(email)->>'available')::boolean then
    raise exception 'That email is already registered.';
  end if;
  v_temp := 'Sg-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4))
                 || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
  v_uid := public.sg_provision_auth_user(
    email, v_temp,
    jsonb_build_object('fullName', btrim("firstName") || ' ' || btrim("lastName"))
  );
  insert into "profiles" (
    id, "email", "firstName", "middleName", "lastName", "dateOfBirth", gender, phone,
    address, citizenship, "residencyCountry", "idType", "idNumber",
    employment, "investmentProfile", compliance, "accountManager",
    role, "accountStatus", "onboardingCompleted", "onboardingCompletedAt", "onboardingSource",
    "createdBy", "displayName", "createdAt", created_at, "updatedAt"
  ) values (
    v_uid, lower(btrim(email)), "firstName", "middleName", "lastName", "dateOfBirth", gender, phone,
    address, citizenship, "residencyCountry", "idType", "idNumber",
    employment, "investmentProfile", compliance, "accountManager",
    'client', 'pending', true, now(), 'admin',
    auth.uid()::text, btrim("firstName") || ' ' || btrim("lastName"), now(), now(), now()
  );
  insert into "wallets" (user_id, balance, currency, label, status)
  values (v_uid, 0, 'USD', 'Primary Wallet', 'active');
  insert into "auditLogs" (actor_id, actor_email, action, details, created_at)
  values (auth.uid(), auth.email(), 'create_investor_account', lower(btrim(email)), now());
  return jsonb_build_object('uid', v_uid, 'temporaryPassword', v_temp);
end $$;

-- Admin creates a staff account (support / finance / compliance / admin).
create or replace function public.create_staff_account(
  email text, "firstName" text default '', "lastName" text default '', role text default 'support'
)
returns jsonb
language plpgsql volatile security definer set search_path = public, auth as $$
#variable_conflict use_variable
declare
  v_uid uuid;
  v_temp text;
begin
  if not public.investor_is_staff() then raise exception 'Staff only.'; end if;
  if role not in ('support', 'finance', 'compliance', 'admin') then
    raise exception 'Role must be support, finance, compliance or admin.';
  end if;
  if not (public.check_email_available(email)->>'available')::boolean then
    raise exception 'That email is already registered.';
  end if;
  v_temp := 'Sg-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4))
                 || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
  v_uid := public.sg_provision_auth_user(
    email, v_temp,
    jsonb_build_object('fullName', btrim("firstName") || ' ' || btrim("lastName"))
  );
  insert into "profiles" (
    id, "email", "firstName", "lastName", role, "accountStatus",
    "onboardingCompleted", "onboardingCompletedAt", "displayName",
    "createdAt", created_at, "updatedAt"
  ) values (
    v_uid, lower(btrim(email)), "firstName", "lastName", role, 'active',
    true, now(), btrim("firstName") || ' ' || btrim("lastName"),
    now(), now(), now()
  );
  insert into "auditLogs" (actor_id, actor_email, action, details, created_at)
  values (auth.uid(), auth.email(), 'create_staff_account', role || ' ' || lower(btrim(email)), now());
  return jsonb_build_object('uid', v_uid, 'temporaryPassword', v_temp, 'role', role);
end $$;
