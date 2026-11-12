-- ============================================================================
-- PATCH: fix set_underlying_price_manually (run after 0002_server_rpcs.sql)
--
-- Symptom: 42P10 "there is no unique or exclusion constraint matching the
-- ON CONFLICT specification" when posting an underlying mark.
--
-- Cause: with #variable_conflict use_variable, PL/pgSQL substituted the
-- `ticker` PARAMETER value into `on conflict (ticker)` instead of the column
-- name, so the index inference failed.
--
-- Fix: update-then-insert upsert with the column explicitly qualified.
-- Paste this whole file into the Supabase SQL Editor and run.
-- ============================================================================

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
  -- RHS names resolve to the parameters (that is what we want).
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
