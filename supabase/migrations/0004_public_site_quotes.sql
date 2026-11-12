-- 0004: public marketing site reads the instrument catalog + desk-posted quotes.
-- The assets table holds public market data (symbols, names, desk marks) — no
-- client or account data — so the anonymous public site may read active rows.
drop policy if exists assets_public_select on "assets";
create policy assets_public_select on "assets" for select to anon
  using (is_active);
