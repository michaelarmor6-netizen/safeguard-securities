-- ============================================================================
-- Safeguard Securities — investor platform schema (Supabase / PostgreSQL)
-- Generated from static analysis of src/services/investor/* usage.
-- Reference: docs/supabase-schema-draft.md
--
-- Conventions:
--   * The services read most columns camelCase (Firestore heritage) but filter
--     and write several as snake_case. Where both spellings are used for the
--     same logical column we keep a physical column in the casing the code
--     WRITES/FILTERS, plus a mirror:
--       - text/number/bool/uuid mirrors -> GENERATED ALWAYS AS (...) stored
--       - timestamptz mirrors           -> BEFORE trigger sync (see bottom)
--   * ids are uuid (default gen_random_uuid) EXCEPT where code clearly uses
--     text ids: assets (symbol), assetGroups (slug), platformSettings
--     ('global'/'fundingDetails'), aiUsage (`${userId}_${period}`),
--     subPortfolioHoldings / crmEnrollments (composite text), crmInstruments
--     (slug w/ generated fallback).
--   * profiles.id and watchlists.id are the Supabase auth uid.
--
-- Run in Supabase SQL Editor (or supabase db push). Idempotent where practical.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================= tables

-- ----------------------------------------------------------- profiles
create table if not exists "profiles" (
  id                      uuid primary key,                    -- auth uid (inserted by code)
  "email"                 text not null,
  "username"              text,
  "firstName"             text,
  "lastName"              text,
  "displayName"           text,
  "phone"                 text,
  "role"                  text not null default 'client',
  "accountStatus"         text not null default 'pending',
  account_status          text generated always as ("accountStatus") stored,   -- filter mirror
  "investorTier"          text default 'standard',
  "createdAt"             timestamptz,
  created_at              timestamptz,                         -- order mirror (trigger)
  "updatedAt"             timestamptz,
  updated_at              timestamptz,                         -- code writes BOTH spellings
  "plan"                  text,
  plan_since              timestamptz,                         -- written snake
  "planSince"             timestamptz,                         -- read camel (trigger)
  "onboardingCompleted"   boolean default false,
  "onboardingCompletedAt" timestamptz,
  "onboardingSkipped"     boolean default false,
  "onboardingSource"      text,
  "createdBy"             text,
  "middleName"            text,
  "dateOfBirth"           text,
  "gender"                text,
  "address"               jsonb,
  "citizenship"           text,
  "residencyCountry"      text,
  "idType"                text,
  "employment"            jsonb,
  "investmentProfile"     jsonb,
  "compliance"            jsonb,
  "accountManager"        jsonb
);
create index if not exists profiles_account_status_idx on "profiles" (account_status);
create index if not exists profiles_created_at_idx     on "profiles" (created_at desc);

-- ----------------------------------------------------------- wallets
create table if not exists "wallets" (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  "userId"    uuid generated always as (user_id) stored,      -- camel read mirror
  balance     numeric not null default 0,
  currency    text not null default 'USD',
  label       text,
  status      text default 'active',
  created_at  timestamptz default now(),
  updated_at  timestamptz
);
create unique index if not exists wallets_user_id_uidx on "wallets" (user_id);

-- ----------------------------------------------------------- watchlists
create table if not exists "watchlists" (
  id          uuid primary key,                               -- = auth uid
  user_id     uuid not null,
  symbols     text[] not null default '{}',
  updated_at  timestamptz
);

-- ----------------------------------------------------------- portfolioHoldings
create table if not exists "portfolioHoldings" (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null,
  "userId"                  uuid generated always as (user_id) stored,
  symbol                    text not null,
  "name"                    text,
  "shares"                  numeric default 0,
  "quantity"                numeric,
  "avgCost"                 numeric default 0,
  "averagePrice"            numeric,
  "currentPrice"            numeric default 0,
  "sector"                  text,
  "assetId"                 text,                             -- assets.id is a symbol string
  strike_price              numeric,                          -- written snake
  "strikePrice"             numeric generated always as (strike_price) stored,
  entry_underlying_price    numeric,                          -- written snake
  "entryUnderlyingPrice"    numeric generated always as (entry_underlying_price) stored,
  "multiplier"              numeric,
  "contractSize"            numeric,
  "optionType"              text check ("optionType" in ('call', 'put')),
  manual_pnl                numeric,                          -- written snake
  "manualPnl"               numeric generated always as (manual_pnl) stored,
  manual_pnl_as_of          text,                             -- 'YYYY-MM-DD'
  "manualPnlAsOf"           text generated always as (manual_pnl_as_of) stored,
  updated_at                timestamptz
);
create index if not exists holdings_user_id_idx on "portfolioHoldings" (user_id);

-- ----------------------------------------------------------- fundingRequests
create table if not exists "fundingRequests" (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null,
  user_email         text,
  amount             numeric not null,
  status             text not null default 'pending'
                     check (status in ('pending', 'approved', 'funded', 'rejected')),
  reference          text,                                    -- SG-FUND{YY}{NNNNN}
  awaiting_payment   boolean default false,
  payment_claimed_at timestamptz,
  payment_proofs     jsonb not null default '[]',
  approved_at        timestamptz,
  funded_at          timestamptz,
  email_sent_at      timestamptz,
  email_error        text,
  source             text not null default 'client' check (source in ('client', 'admin')),
  note               text,
  recorded_by_email  text,
  recorded_by_uid    uuid,
  created_at         timestamptz default now(),
  updated_at         timestamptz
);
create index if not exists funding_user_status_idx on "fundingRequests" (user_id, status);
create index if not exists funding_created_idx     on "fundingRequests" (created_at desc);

-- ----------------------------------------------------------- invoices
create table if not exists "invoices" (
  id                           uuid primary key default gen_random_uuid(),
  number                       text not null,
  user_id                      uuid not null,
  bill_to_name                 text not null,
  bill_to_email                text not null,
  bill_to_company              text,
  bill_to_address              text,
  currency                     text not null default 'USD',
  line_items                   jsonb not null default '[]',
  tax_rate                     numeric not null default 0,
  tax_label                    text not null default 'Tax',
  notes                        text,
  payment_terms                text,
  due_date                     timestamptz,
  include_payment_instructions boolean not null default false,
  send_mode                    text not null default 'auto' check (send_mode in ('auto', 'manual')),
  status                       text not null default 'issued' check (status in ('issued', 'sent', 'paid', 'void')),
  issued_at                    timestamptz,
  payment_claimed_at           timestamptz,
  payment_proofs               jsonb,
  paid_at                      timestamptz,
  email_sent_at                timestamptz,
  email_error                  text,
  created_by_uid               uuid,
  created_by_email             text,
  created_at                   timestamptz default now(),
  updated_at                   timestamptz
);
create index if not exists invoices_user_idx    on "invoices" (user_id);
create index if not exists invoices_created_idx on "invoices" (created_at desc);

-- ----------------------------------------------------------- clientNotifications
create table if not exists "clientNotifications" (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  type        text not null default 'invoice',
  title       text not null,
  body        text not null default '',
  href        text not null default '/workspace/invoices',
  "read"      boolean not null default false,                 -- reserved word: quoted
  created_at  timestamptz default now(),
  updated_at  timestamptz
);
create index if not exists client_notices_user_idx on "clientNotifications" (user_id, created_at desc);

-- ----------------------------------------------------------- staffNotifications
create table if not exists "staffNotifications" (
  id          uuid primary key default gen_random_uuid(),
  type        text,                                           -- 'invoice-payment'
  title       text not null,
  body        text not null default '',
  href        text not null default '/admin/transactions',
  invoice_id  uuid,
  user_id     uuid,
  "read"      boolean not null default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz
);
create index if not exists staff_notices_created_idx on "staffNotifications" (created_at desc);

-- ----------------------------------------------------------- adminOrders (key: orders)
create table if not exists "adminOrders" (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null,
  "userId"                  uuid generated always as (user_id) stored,
  user_email                text,
  "userEmail"               text generated always as (user_email) stored,
  asset_id                  text,                             -- assets.id = symbol
  "assetId"                 text generated always as (asset_id) stored,
  symbol                    text not null,
  side                      text not null check (side in ('buy', 'sell')),
  order_type                text not null default 'market',
  "orderType"               text generated always as (order_type) stored,
  time_in_force             text not null default 'day',
  "timeInForce"             text generated always as (time_in_force) stored,
  quantity                  numeric not null default 0,
  limit_price               numeric,
  "limitPrice"              numeric generated always as (limit_price) stored,
  stop_price                numeric,
  "stopPrice"               numeric generated always as (stop_price) stored,
  price                     numeric,
  status                    text not null default 'pending'
                            check (status in ('pending', 'working', 'partially_filled', 'filled', 'cancelled', 'rejected', 'expired')),
  filled_quantity           numeric not null default 0,
  "filledQuantity"          numeric generated always as (filled_quantity) stored,
  avg_fill_price            numeric,
  "avgFillPrice"            numeric generated always as (avg_fill_price) stored,
  client_status             text default 'pending',
  "clientStatus"            text generated always as (client_status) stored,
  rejection_reason          text,
  "rejectionReason"         text generated always as (rejection_reason) stored,
  option_type               text check (option_type in ('call', 'put')),
  "optionType"              text generated always as (option_type) stored,
  strike_price              numeric,                          -- written snake
  "strikePrice"             numeric generated always as (strike_price) stored,
  expiry_date               text,
  "expiryDate"              text generated always as (expiry_date) stored,
  contract_size             numeric,
  "contractSize"            numeric generated always as (contract_size) stored,
  entry_underlying_price    numeric,
  "entryUnderlyingPrice"    numeric generated always as (entry_underlying_price) stored,
  delivery_type             text check (delivery_type in ('cash_settled', 'physical')),
  "deliveryType"            text generated always as (delivery_type) stored,
  fees                      numeric default 0,
  commission                numeric default 0,
  sub_portfolio_id          uuid,
  "subPortfolioId"          uuid generated always as (sub_portfolio_id) stored,
  created_at                timestamptz default now(),
  "createdAt"               timestamptz,                      -- camel read mirror (trigger)
  filled_at                 timestamptz,
  "filledAt"                timestamptz,                      -- trigger
  cancelled_at              timestamptz,
  "cancelledAt"             timestamptz,                      -- trigger
  updated_at                timestamptz
);
create index if not exists orders_user_created_idx on "adminOrders" (user_id, created_at desc);

-- ----------------------------------------------------------- priceAlerts
create table if not exists "priceAlerts" (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  asset_id        text not null,
  symbol          text not null,
  "condition"     text not null default 'above' check ("condition" in ('above', 'below')),
  target_price    numeric not null,
  status          text not null default 'active' check (status in ('active', 'triggered', 'cancelled')),
  seen            boolean not null default true,
  triggered_at    timestamptz,
  triggered_price numeric,
  created_at      timestamptz default now(),
  updated_at      timestamptz
);
create index if not exists alerts_user_idx on "priceAlerts" (user_id, created_at desc);

-- ----------------------------------------------------------- trades
create table if not exists "trades" (
  id                        uuid primary key default gen_random_uuid(),
  trade_ref                 text,
  "tradeRef"                text generated always as (trade_ref) stored,
  order_id                  uuid,
  "orderId"                 uuid generated always as (order_id) stored,
  user_id                   uuid not null,
  "userId"                  uuid generated always as (user_id) stored,
  user_email                text,
  "userEmail"               text generated always as (user_email) stored,
  asset_id                  text,
  "assetId"                 text generated always as (asset_id) stored,
  sub_portfolio_id          uuid,
  "subPortfolioId"          uuid generated always as (sub_portfolio_id) stored,
  symbol                    text not null,
  side                      text not null check (side in ('buy', 'sell')),
  quantity                  numeric not null default 0,
  price                     numeric not null default 0,
  gross_amount              numeric not null default 0,
  "grossAmount"             numeric generated always as (gross_amount) stored,
  fees                      numeric not null default 0,
  commission                numeric not null default 0,
  currency                  text not null default 'USD',
  executed_at               timestamptz,
  "executedAt"              timestamptz,                      -- trigger mirror
  remarks                   text not null default 'OPEN'
                            check (remarks in ('OPEN', 'PARTIALLY_FILLED', 'CLOSED', 'ADJUSTED')),
  client_status             text,
  "clientStatus"            text generated always as (client_status) stored,
  option_type               text,
  "optionType"              text generated always as (option_type) stored,
  strike_price              numeric,                          -- written snake
  "strikePrice"             numeric generated always as (strike_price) stored,
  entry_underlying_price    numeric,
  "entryUnderlyingPrice"    numeric generated always as (entry_underlying_price) stored,
  expiry_date               text,
  "expiryDate"              text generated always as (expiry_date) stored,
  contract_size             numeric,
  "contractSize"            numeric generated always as (contract_size) stored,
  broker_execution_id       text,
  "brokerExecutionId"       text generated always as (broker_execution_id) stored,
  updated_at                timestamptz
);
create index if not exists trades_user_exec_idx on "trades" (user_id, executed_at desc);
create index if not exists trades_order_idx     on "trades" (order_id);

-- ----------------------------------------------------------- platformSettings (key: settings)
create table if not exists "platformSettings" (
  id                            text primary key,             -- 'global' | 'fundingDetails'
  "announcementEnabled"         boolean default false,
  "announcementMessage"         text default '',
  "platformName"                text,
  "defaultCurrency"             text default 'USD',
  "statementFooterText"         text,
  "deskTimezone"                text default 'America/New_York',
  "logoUrl"                     text default '',
  "brandPrimaryColor"           text,
  "brandAccentColor"            text,
  "defaultLanguage"             text default 'en',
  "supportedLanguages"          text[] not null default '{en}',
  "notifyOnNewApplicant"        boolean default true,
  "notifyOnFundingRequest"      boolean default true,
  "notifyOnLargeTrade"          boolean default false,
  "largeTradeThreshold"         numeric default 50000,
  "sessionTimeoutMinutes"       integer default 60,
  "minPasswordLength"           integer default 6,
  "welcomeEmailSubjectOverride" text default '',
  "welcomeEmailIntroOverride"   text default '',
  "invoicePrefix"               text default 'SG-INV',
  "invoiceIncludeYear"          boolean default true,
  "invoicePadLength"            integer default 5,
  "bankEnabled"                 boolean default false,
  "bankName"                    text default '',
  "bankAddress"                 text default '',
  "bankSwift"                   text default '',
  "bankAccountName"             text default '',
  "bankAccountNumber"           text default '',
  "beneficiaryAddress"          text default '',
  "bankRoutingOrIban"           text default '',
  "paymentReason"               text default 'Investment account funding',
  "cryptoEnabled"               boolean default false,
  "cryptoWallets"               jsonb not null default '[]',
  "extraInstructions"           text default '',
  "emailSubject"                text default '',
  "emailIntro"                  text default '',
  "supportEmail"                text default '',
  "supportPhone"                text default '',
  "companyAddress"              text default '',
  updated_at                    timestamptz
);

-- ----------------------------------------------------------- supportTickets
create table if not exists "supportTickets" (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  user_email   text,
  subject      text not null,
  message      text not null,
  status       text not null default 'open' check (status in ('open', 'answered', 'closed')),
  admin_reply  text,
  created_at   timestamptz default now(),
  updated_at   timestamptz
);
create index if not exists tickets_user_idx on "supportTickets" (user_id, created_at desc);

-- ----------------------------------------------------------- auditLogs
create table if not exists "auditLogs" (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid,                                          -- written snake
  "actorId"    uuid generated always as (actor_id) stored,    -- read camel
  actor_email  text,
  "actorEmail" text generated always as (actor_email) stored,
  action       text not null,
  details      text,
  created_at   timestamptz default now(),
  "createdAt"  timestamptz                                    -- trigger mirror
);
create index if not exists audit_created_idx on "auditLogs" (created_at desc);

-- ----------------------------------------------------------- kycSubmissions
create table if not exists "kycSubmissions" (
  id                uuid primary key default gen_random_uuid(),
  "userId"          uuid not null,                            -- browser inserts camel
  user_id           uuid generated always as ("userId") stored,
  "userEmail"       text,
  user_email        text generated always as ("userEmail") stored,
  "fullName"        text not null,
  full_name         text generated always as ("fullName") stored,
  "dateOfBirth"     text,
  date_of_birth     text generated always as ("dateOfBirth") stored,
  address           text,
  phone             text,
  "idType"          text,
  id_type           text generated always as ("idType") stored,
  "idNumber"        text,
  id_number         text generated always as ("idNumber") stored,
  id_document_url   text,
  status            text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  review_note       text,
  created_at        timestamptz default now(),
  updated_at        timestamptz
);
create index if not exists kyc_sub_user_idx on "kycSubmissions" (user_id, created_at desc);

-- ----------------------------------------------------------- kycDocuments
create table if not exists "kycDocuments" (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  user_email    text,
  client_name   text,
  doc_type      text not null,
  file_name     text not null,
  storage_path  text,
  file_url      text,
  file_removed  boolean not null default false,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note   text,
  submitted_at  timestamptz default now(),
  reviewed_at   timestamptz,
  updated_at    timestamptz
);
create index if not exists kyc_doc_user_idx on "kycDocuments" (user_id, submitted_at desc);

-- ----------------------------------------------------------- strategies
create table if not exists "strategies" (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  description       text not null default '',
  risk_level        text not null default 'medium' check (risk_level in ('low', 'medium', 'high')),
  target_allocation text not null default '',
  created_at        timestamptz default now()
);

-- ----------------------------------------------------------- aiSignals
create table if not exists "aiSignals" (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null,
  symbol             text not null,
  side               text not null check (side in ('buy', 'sell', 'hold')),
  confidence         numeric not null default 0,
  rationale          text not null default '',
  "indicatorSummary" text not null default '',
  indicators         jsonb,
  created_at         timestamptz default now()
);
create index if not exists ai_signals_user_idx on "aiSignals" (user_id, created_at desc);

-- ----------------------------------------------------------- aiUsage
create table if not exists "aiUsage" (
  id            text primary key,                             -- `${userId}_${YYYY-MM}`
  user_id       uuid not null,
  period        text not null,                                -- '2026-08'
  signals_used  integer not null default 0,
  updated_at    timestamptz
);

-- ----------------------------------------------------------- planRequests
create table if not exists "planRequests" (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  user_email      text not null default '',
  current_plan    text not null,
  requested_plan  text not null,
  status          text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  note            text not null default '',
  created_at      timestamptz default now(),
  resolved_at     timestamptz
);
create index if not exists plan_req_status_idx on "planRequests" (status);

-- ----------------------------------------------------------- referralCodes
create table if not exists "referralCodes" (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  user_id     uuid not null,
  created_at  timestamptz default now()
);

-- ----------------------------------------------------------- referrals
create table if not exists "referrals" (
  id               uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null,
  referred_user_id uuid not null,
  referred_email   text not null default '',
  code             text not null,
  status           text not null default 'signed_up' check (status in ('signed_up', 'funded', 'rejected')),
  created_at       timestamptz default now()
);
create index if not exists referrals_referrer_idx on "referrals" (referrer_user_id, created_at desc);

-- ----------------------------------------------------------- assetGroups
create table if not exists "assetGroups" (
  id            text primary key,                             -- slug, e.g. 'metals'
  "label"       text not null,
  "assetClass"  text not null,
  asset_class   text generated always as ("assetClass") stored,   -- filter mirror
  "parentLabel" text not null default '',
  "sortOrder"   integer not null default 0,
  sort_order    integer generated always as ("sortOrder") stored, -- order mirror
  "description" text
);
create index if not exists asset_groups_class_idx on "assetGroups" (asset_class, sort_order);

-- ----------------------------------------------------------- assets
create table if not exists "assets" (
  id                       text primary key,                  -- uppercase symbol
  symbol                   text not null,
  "name"                   text not null,
  "assetClass"             text not null,
  asset_class              text generated always as ("assetClass") stored,
  "groupId"                text,                              -- assetGroups.id (slug)
  group_id                 text generated always as ("groupId") stored,
  "exchange"               text,
  "sector"                 text,
  "contractUnit"           text,
  "priority"               text not null default 'core',
  "quoteSymbol"            text,
  "underlyingPriceSymbol"  text,
  "dataProvider"           text not null default 'finnhub',
  "quote"                  jsonb,                             -- {price,change,changePercent,fetchedAt}
  is_tradable              boolean not null default true,     -- written snake
  "isTradable"             boolean generated always as (is_tradable) stored,
  is_active                boolean not null default true,     -- written + filtered snake
  "isActive"               boolean generated always as (is_active) stored,
  "sortOrder"              integer,
  created_at               timestamptz,                       -- written snake
  "createdAt"              timestamptz,                       -- trigger mirror
  updated_at               timestamptz,
  "updatedAt"              timestamptz                        -- trigger mirror
);
create index if not exists assets_class_idx  on "assets" (asset_class) where is_active;
create index if not exists assets_group_idx  on "assets" (group_id) where is_active;
create index if not exists assets_symbol_idx on "assets" (symbol);

-- ----------------------------------------------------------- subPortfolios
create table if not exists "subPortfolios" (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null,
  name                  text not null,
  asset_class           text not null default 'equities'
                        check (asset_class in ('equities', 'crypto', 'commodities', 'managed_strategy')),
  base_currency         text not null default 'USD',
  target_allocation_pct numeric,
  "targetAllocationPct" numeric,                              -- camel patch mirror (plain col)
  risk_band             text check (risk_band in ('conservative', 'moderate', 'aggressive')),
  "riskBand"            text,
  status                text not null default 'active' check (status in ('active', 'paused', 'closed')),
  created_at            timestamptz default now(),
  updated_at            timestamptz
);
create index if not exists sub_portfolios_user_idx on "subPortfolios" (user_id);

-- ----------------------------------------------------------- subPortfolioHoldings
create table if not exists "subPortfolioHoldings" (
  id               text primary key,                          -- `${subPortfolioId}_${SYMBOL}`
  sub_portfolio_id uuid not null references "subPortfolios" (id) on delete cascade,
  user_id          uuid not null,
  symbol           text not null,
  display_name     text,
  quantity         numeric not null default 0,
  avg_cost         numeric not null default 0,
  "avgCost"        numeric,
  mark_price       numeric,
  "markPrice"      numeric,
  unit_label       text not null default 'shares',
  currency         text not null default 'USD',
  updated_at       timestamptz
);
create index if not exists sub_holdings_sleeve_idx on "subPortfolioHoldings" (sub_portfolio_id);

-- ----------------------------------------------------------- portfolioSnapshots
create table if not exists "portfolioSnapshots" (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null,
  date               date not null,
  portfolio_value    numeric not null default 0,
  cash_balance       numeric not null default 0,
  total_value        numeric not null default 0,
  day_change         numeric not null default 0,
  day_change_percent numeric not null default 0,
  unique (user_id, date)
);
create index if not exists snapshots_user_date_idx on "portfolioSnapshots" (user_id, date);

-- ----------------------------------------------------------- crmLeads
create table if not exists "crmLeads" (
  id               uuid primary key default gen_random_uuid(),
  first_name       text not null default '',
  last_name        text not null default '',
  company          text,
  phone_e164       text,
  email            text,
  country          text,
  tags             text[] not null default '{}',
  status           text not null default 'new' check (status in ('new', 'working', 'customer', 'dead')),
  source           jsonb not null default '{"kind":"manual"}',
  consent_basis    text not null default 'unknown'
                   check (consent_basis in ('inquiry', 'existing_business', 'purchased_list', 'unknown')),
  consent_note     text,
  "consentNote"    text,                                      -- camel patch mirror
  gi_lead_id       text,
  payload          jsonb,
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  last_exported_at timestamptz
);
create index if not exists crm_leads_created_idx on "crmLeads" (created_at desc);
create index if not exists crm_leads_email_idx   on "crmLeads" (email);
create index if not exists crm_leads_phone_idx   on "crmLeads" (phone_e164);

-- ----------------------------------------------------------- crmImports
create table if not exists "crmImports" (
  id                 uuid primary key default gen_random_uuid(),
  "files"            jsonb not null default '[]',
  "mapping"          jsonb not null default '{}',
  "consentBasis"     text not null default 'unknown',
  consent_basis      text generated always as ("consentBasis") stored,
  "counts"           jsonb not null default '{}',
  "confirmedBy"      text not null default '',
  confirmed_by       text generated always as ("confirmedBy") stored,
  "confirmedByEmail" text not null default '',
  confirmed_by_email text generated always as ("confirmedByEmail") stored,
  created_at         timestamptz default now()
);
create index if not exists crm_imports_created_idx on "crmImports" (created_at desc);

-- ----------------------------------------------------------- crmSuppression
create table if not exists "crmSuppression" (
  id       uuid primary key default gen_random_uuid(),
  "type"   text not null check ("type" in ('email', 'phone')),
  "value"  text not null,
  reason   text not null default 'manual' check (reason in ('unsubscribe', 'bounce', 'complaint', 'manual')),
  source   text,
  added_at timestamptz default now()
);
create index if not exists crm_supp_value_idx on "crmSuppression" ("value");
create unique index if not exists crm_supp_type_value_uidx on "crmSuppression" ("type", "value");

-- ----------------------------------------------------------- crmInstruments
create table if not exists "crmInstruments" (
  id                      text primary key default gen_random_uuid()::text,
  slug                    text not null unique,
  name                    text not null,
  asset_class             text not null default 'other',
  "assetClass"            text,                               -- camel seed/patch mirror
  status                  text not null default 'active',
  landing                 jsonb not null default '{}',
  risk_disclosure         text not null default '',
  "riskDisclosure"        text,
  default_appointment_url text not null default '',
  "defaultAppointmentUrl" text,
  default_demo_url        text not null default '',
  "defaultDemoUrl"        text,
  default_steps           jsonb,
  "defaultSteps"          jsonb,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- ----------------------------------------------------------- crmCampaigns
create table if not exists "crmCampaigns" (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  track           text,                                       -- legacy alias of instrument_slug
  instrument_slug text,
  status          text not null default 'draft',
  steps           jsonb not null default '[]',
  settings        jsonb not null default '{}',
  stats           jsonb not null default '{}',
  created_by      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists crm_campaigns_created_idx on "crmCampaigns" (created_at desc);

-- ----------------------------------------------------------- crmEnrollments
create table if not exists "crmEnrollments" (
  id             text primary key,                            -- `${campaignId}_${leadId}`
  campaign_id    uuid not null,
  lead_id        uuid not null,
  email          text not null,
  first_name     text not null default 'there',
  step           integer not null default 0,
  next_send_at   timestamptz,
  status         text not null default 'active',
  last_error     text,
  enrolled_at    timestamptz default now(),
  last_sent_at   timestamptz,
  funnel_stage   text,
  unique (campaign_id, lead_id)
);
create index if not exists crm_enr_campaign_idx on "crmEnrollments" (campaign_id);

-- ----------------------------------------------------------- crmInbound
create table if not exists "crmInbound" (
  id                 uuid primary key default gen_random_uuid(),
  gi_lead_id         text not null,
  mission            text not null default 'unspecified',
  segment            text not null default 'investor-prospect',
  lead               jsonb not null default '{}',
  dossier            jsonb not null default '{}',
  status             text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  received_at        timestamptz default now(),
  reviewed_by_email  text,
  reviewed_at        timestamptz,
  decline_reason     text
);
create index if not exists crm_inbound_status_idx on "crmInbound" (status, received_at desc);

-- ----------------------------------------------------------- counters (auxiliary)
create table if not exists "counters" (
  id    text primary key,                                     -- 'funding-2026', 'invoices-2026'
  value integer not null default 0
);

-- ============================================================= staff helpers
-- SECURITY DEFINER so staff checks inside RLS policies don't recurse through
-- the profiles RLS itself. Owned by the SQL-editor role (postgres).
-- Created AFTER the tables: PostgreSQL validates SQL function bodies against
-- existing relations at CREATE time.

create or replace function public.investor_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from "profiles"
    where id = auth.uid()
      and coalesce("role", 'client') in ('support', 'admin', 'finance', 'compliance', 'super_admin')
  );
$$;

create or replace function public.investor_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from "profiles"
    where id = auth.uid()
      and coalesce("role", 'client') in ('admin', 'super_admin')
  );
$$;

-- ============================================================= timestamp mirror triggers
-- timestamptz casts are not immutable, so dual-spelled timestamp pairs need a
-- BEFORE trigger instead of generated columns. Each keeps both spellings in
-- sync regardless of which one the code writes.

-- profiles: "createdAt"<->created_at, "updatedAt"<->updated_at, plan_since<->"planSince"
create or replace function public.profiles_ts_sync() returns trigger as $$
begin
  if new."createdAt" is null and new.created_at is not null then new."createdAt" := new.created_at; end if;
  if new.created_at is null and new."createdAt" is not null then new.created_at := new."createdAt"; end if;
  if new."updatedAt" is null and new.updated_at is not null then new."updatedAt" := new.updated_at; end if;
  if new.updated_at is null and new."updatedAt" is not null then new.updated_at := new."updatedAt"; end if;
  if new."planSince" is null and new.plan_since is not null then new."planSince" := new.plan_since; end if;
  if new.plan_since is null and new."planSince" is not null then new.plan_since := new."planSince"; end if;
  return new;
end $$ language plpgsql;
drop trigger if exists profiles_ts_sync on "profiles";
create trigger profiles_ts_sync before insert or update on "profiles"
  for each row execute function profiles_ts_sync();

-- adminOrders: "createdAt"<->created_at, "filledAt"<->filled_at, "cancelledAt"<->cancelled_at
create or replace function public.admin_orders_ts_sync() returns trigger as $$
begin
  if new."createdAt" is null and new.created_at is not null then new."createdAt" := new.created_at; end if;
  if new.created_at is null and new."createdAt" is not null then new.created_at := new."createdAt"; end if;
  if new."filledAt" is null and new.filled_at is not null then new."filledAt" := new.filled_at; end if;
  if new.filled_at is null and new."filledAt" is not null then new.filled_at := new."filledAt"; end if;
  if new."cancelledAt" is null and new.cancelled_at is not null then new."cancelledAt" := new.cancelled_at; end if;
  if new.cancelled_at is null and new."cancelledAt" is not null then new.cancelled_at := new."cancelledAt"; end if;
  return new;
end $$ language plpgsql;
drop trigger if exists admin_orders_ts_sync on "adminOrders";
create trigger admin_orders_ts_sync before insert or update on "adminOrders"
  for each row execute function admin_orders_ts_sync();

-- trades: "executedAt"<->executed_at
create or replace function public.trades_ts_sync() returns trigger as $$
begin
  if new."executedAt" is null and new.executed_at is not null then new."executedAt" := new.executed_at; end if;
  if new.executed_at is null and new."executedAt" is not null then new.executed_at := new."executedAt"; end if;
  return new;
end $$ language plpgsql;
drop trigger if exists trades_ts_sync on "trades";
create trigger trades_ts_sync before insert or update on "trades"
  for each row execute function trades_ts_sync();

-- assets: "createdAt"<->created_at, "updatedAt"<->updated_at
create or replace function public.assets_ts_sync() returns trigger as $$
begin
  if new."createdAt" is null and new.created_at is not null then new."createdAt" := new.created_at; end if;
  if new.created_at is null and new."createdAt" is not null then new.created_at := new."createdAt"; end if;
  if new."updatedAt" is null and new.updated_at is not null then new."updatedAt" := new.updated_at; end if;
  if new.updated_at is null and new."updatedAt" is not null then new.updated_at := new."updatedAt"; end if;
  return new;
end $$ language plpgsql;
drop trigger if exists assets_ts_sync on "assets";
create trigger assets_ts_sync before insert or update on "assets"
  for each row execute function assets_ts_sync();

-- auditLogs: "createdAt"<->created_at
create or replace function public.audit_logs_ts_sync() returns trigger as $$
begin
  if new."createdAt" is null and new.created_at is not null then new."createdAt" := new.created_at; end if;
  if new.created_at is null and new."createdAt" is not null then new.created_at := new."createdAt"; end if;
  return new;
end $$ language plpgsql;
drop trigger if exists audit_logs_ts_sync on "auditLogs";
create trigger audit_logs_ts_sync before insert or update on "auditLogs"
  for each row execute function audit_logs_ts_sync();

-- ============================================================= RLS

alter table "profiles"              enable row level security;
alter table "wallets"               enable row level security;
alter table "watchlists"            enable row level security;
alter table "portfolioHoldings"     enable row level security;
alter table "fundingRequests"       enable row level security;
alter table "invoices"              enable row level security;
alter table "clientNotifications"   enable row level security;
alter table "staffNotifications"    enable row level security;
alter table "adminOrders"           enable row level security;
alter table "priceAlerts"           enable row level security;
alter table "trades"                enable row level security;
alter table "platformSettings"      enable row level security;
alter table "supportTickets"        enable row level security;
alter table "auditLogs"             enable row level security;
alter table "kycSubmissions"        enable row level security;
alter table "kycDocuments"          enable row level security;
alter table "strategies"            enable row level security;
alter table "aiSignals"             enable row level security;
alter table "aiUsage"               enable row level security;
alter table "planRequests"          enable row level security;
alter table "referralCodes"         enable row level security;
alter table "referrals"             enable row level security;
alter table "assetGroups"           enable row level security;
alter table "assets"                enable row level security;
alter table "subPortfolios"         enable row level security;
alter table "subPortfolioHoldings"  enable row level security;
alter table "portfolioSnapshots"    enable row level security;
alter table "crmLeads"              enable row level security;
alter table "crmImports"            enable row level security;
alter table "crmSuppression"        enable row level security;
alter table "crmInstruments"        enable row level security;
alter table "crmCampaigns"          enable row level security;
alter table "crmEnrollments"        enable row level security;
alter table "crmInbound"            enable row level security;
alter table "counters"              enable row level security;

-- profiles ----------------------------------------------------------------
drop policy if exists profiles_select on "profiles";
create policy profiles_select on "profiles" for select to authenticated
  using (id = auth.uid() or public.investor_is_staff());
drop policy if exists profiles_insert on "profiles";
create policy profiles_insert on "profiles" for insert to authenticated
  with check (id = auth.uid() or public.investor_is_staff());
drop policy if exists profiles_update on "profiles";
create policy profiles_update on "profiles" for update to authenticated
  using (id = auth.uid() or public.investor_is_staff());

-- wallets -----------------------------------------------------------------
drop policy if exists wallets_select on "wallets";
create policy wallets_select on "wallets" for select to authenticated
  using (user_id = auth.uid() or public.investor_is_staff());
drop policy if exists wallets_insert on "wallets";
create policy wallets_insert on "wallets" for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists wallets_update on "wallets";
create policy wallets_update on "wallets" for update to authenticated
  using (user_id = auth.uid() or public.investor_is_staff());

-- watchlists --------------------------------------------------------------
drop policy if exists watchlists_all on "watchlists";
create policy watchlists_all on "watchlists" for all to authenticated
  using (user_id = auth.uid() or id = auth.uid())
  with check (user_id = auth.uid() or id = auth.uid());

-- portfolioHoldings -------------------------------------------------------
drop policy if exists holdings_select on "portfolioHoldings";
create policy holdings_select on "portfolioHoldings" for select to authenticated
  using (user_id = auth.uid() or public.investor_is_staff());
drop policy if exists holdings_write on "portfolioHoldings";
create policy holdings_write on "portfolioHoldings" for all to authenticated
  using (user_id = auth.uid() or public.investor_is_staff())
  with check (user_id = auth.uid() or public.investor_is_staff());

-- fundingRequests ---------------------------------------------------------
drop policy if exists funding_select on "fundingRequests";
create policy funding_select on "fundingRequests" for select to authenticated
  using (user_id = auth.uid() or public.investor_is_staff());
drop policy if exists funding_insert on "fundingRequests";
create policy funding_insert on "fundingRequests" for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists funding_update on "fundingRequests";
create policy funding_update on "fundingRequests" for update to authenticated
  using (user_id = auth.uid() or public.investor_is_staff());

-- invoices ----------------------------------------------------------------
drop policy if exists invoices_select on "invoices";
create policy invoices_select on "invoices" for select to authenticated
  using (user_id = auth.uid() or public.investor_is_staff());
drop policy if exists invoices_insert on "invoices";
create policy invoices_insert on "invoices" for insert to authenticated
  with check (public.investor_is_staff());
drop policy if exists invoices_update on "invoices";
create policy invoices_update on "invoices" for update to authenticated
  using (user_id = auth.uid() or public.investor_is_staff());

-- clientNotifications -----------------------------------------------------
drop policy if exists client_notices_select on "clientNotifications";
create policy client_notices_select on "clientNotifications" for select to authenticated
  using (user_id = auth.uid());
drop policy if exists client_notices_insert on "clientNotifications";
create policy client_notices_insert on "clientNotifications" for insert to authenticated
  with check (user_id = auth.uid() or public.investor_is_staff());
drop policy if exists client_notices_update on "clientNotifications";
create policy client_notices_update on "clientNotifications" for update to authenticated
  using (user_id = auth.uid());

-- staffNotifications ------------------------------------------------------
drop policy if exists staff_notices_select on "staffNotifications";
create policy staff_notices_select on "staffNotifications" for select to authenticated
  using (public.investor_is_staff());
drop policy if exists staff_notices_write on "staffNotifications";
create policy staff_notices_write on "staffNotifications" for all to authenticated
  using (public.investor_is_staff())
  with check (public.investor_is_staff());

-- adminOrders -------------------------------------------------------------
drop policy if exists orders_select on "adminOrders";
create policy orders_select on "adminOrders" for select to authenticated
  using (user_id = auth.uid() or public.investor_is_staff());
drop policy if exists orders_insert on "adminOrders";
create policy orders_insert on "adminOrders" for insert to authenticated
  with check (user_id = auth.uid() or public.investor_is_staff());
drop policy if exists orders_update on "adminOrders";
create policy orders_update on "adminOrders" for update to authenticated
  using (user_id = auth.uid() or public.investor_is_staff());

-- priceAlerts -------------------------------------------------------------
drop policy if exists alerts_all on "priceAlerts";
create policy alerts_all on "priceAlerts" for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- trades ------------------------------------------------------------------
drop policy if exists trades_select on "trades";
create policy trades_select on "trades" for select to authenticated
  using (user_id = auth.uid() or public.investor_is_staff());
drop policy if exists trades_insert on "trades";
create policy trades_insert on "trades" for insert to authenticated
  with check (public.investor_is_staff() or user_id = auth.uid());
drop policy if exists trades_update on "trades";
create policy trades_update on "trades" for update to authenticated
  using (public.investor_is_staff() or user_id = auth.uid());

-- platformSettings --------------------------------------------------------
drop policy if exists settings_select on "platformSettings";
create policy settings_select on "platformSettings" for select to authenticated
  using (true);
drop policy if exists settings_write on "platformSettings";
create policy settings_write on "platformSettings" for all to authenticated
  using (public.investor_is_staff())
  with check (public.investor_is_staff());

-- supportTickets ----------------------------------------------------------
drop policy if exists tickets_select on "supportTickets";
create policy tickets_select on "supportTickets" for select to authenticated
  using (user_id = auth.uid() or public.investor_is_staff());
drop policy if exists tickets_insert on "supportTickets";
create policy tickets_insert on "supportTickets" for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists tickets_update on "supportTickets";
create policy tickets_update on "supportTickets" for update to authenticated
  using (user_id = auth.uid() or public.investor_is_staff());

-- auditLogs ---------------------------------------------------------------
drop policy if exists audit_insert on "auditLogs";
create policy audit_insert on "auditLogs" for insert to authenticated
  with check (true);
drop policy if exists audit_select on "auditLogs";
create policy audit_select on "auditLogs" for select to authenticated
  using (public.investor_is_staff());

-- kycSubmissions ----------------------------------------------------------
drop policy if exists kyc_sub_select on "kycSubmissions";
create policy kyc_sub_select on "kycSubmissions" for select to authenticated
  using ("userId" = auth.uid() or public.investor_is_staff());
drop policy if exists kyc_sub_insert on "kycSubmissions";
create policy kyc_sub_insert on "kycSubmissions" for insert to authenticated
  with check ("userId" = auth.uid());
drop policy if exists kyc_sub_update on "kycSubmissions";
create policy kyc_sub_update on "kycSubmissions" for update to authenticated
  using ("userId" = auth.uid() or public.investor_is_staff());

-- kycDocuments ------------------------------------------------------------
drop policy if exists kyc_doc_all on "kycDocuments";
create policy kyc_doc_all on "kycDocuments" for all to authenticated
  using (user_id = auth.uid() or public.investor_is_staff())
  with check (user_id = auth.uid() or public.investor_is_staff());

-- strategies --------------------------------------------------------------
drop policy if exists strategies_select on "strategies";
create policy strategies_select on "strategies" for select to authenticated
  using (true);
drop policy if exists strategies_write on "strategies";
create policy strategies_write on "strategies" for all to authenticated
  using (public.investor_is_staff())
  with check (public.investor_is_staff());

-- aiSignals / aiUsage -----------------------------------------------------
drop policy if exists ai_signals_select on "aiSignals";
create policy ai_signals_select on "aiSignals" for select to authenticated
  using (user_id = auth.uid() or public.investor_is_staff());
drop policy if exists ai_usage_select on "aiUsage";
create policy ai_usage_select on "aiUsage" for select to authenticated
  using (user_id = auth.uid() or public.investor_is_staff());

-- planRequests ------------------------------------------------------------
drop policy if exists plan_req_insert on "planRequests";
create policy plan_req_insert on "planRequests" for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists plan_req_select on "planRequests";
create policy plan_req_select on "planRequests" for select to authenticated
  using (user_id = auth.uid() or public.investor_is_staff());
drop policy if exists plan_req_update on "planRequests";
create policy plan_req_update on "planRequests" for update to authenticated
  using (public.investor_is_staff());

-- referralCodes / referrals ----------------------------------------------
drop policy if exists ref_codes_all on "referralCodes";
create policy ref_codes_all on "referralCodes" for all to authenticated
  using (user_id = auth.uid() or public.investor_is_staff())
  with check (user_id = auth.uid() or public.investor_is_staff());
drop policy if exists referrals_select on "referrals";
create policy referrals_select on "referrals" for select to authenticated
  using (referrer_user_id = auth.uid() or public.investor_is_staff());
drop policy if exists referrals_insert on "referrals";
create policy referrals_insert on "referrals" for insert to authenticated
  with check (referrer_user_id = auth.uid());

-- assetGroups / assets (catalog: public read, staff write) ----------------
drop policy if exists asset_groups_select on "assetGroups";
create policy asset_groups_select on "assetGroups" for select to authenticated
  using (true);
drop policy if exists asset_groups_write on "assetGroups";
create policy asset_groups_write on "assetGroups" for all to authenticated
  using (public.investor_is_staff())
  with check (public.investor_is_staff());
drop policy if exists assets_select on "assets";
create policy assets_select on "assets" for select to authenticated
  using (true);
drop policy if exists assets_write on "assets";
create policy assets_write on "assets" for all to authenticated
  using (public.investor_is_staff())
  with check (public.investor_is_staff());

-- subPortfolios / subPortfolioHoldings ------------------------------------
drop policy if exists sub_portfolios_all on "subPortfolios";
create policy sub_portfolios_all on "subPortfolios" for all to authenticated
  using (user_id = auth.uid() or public.investor_is_staff())
  with check (user_id = auth.uid() or public.investor_is_staff());
drop policy if exists sub_holdings_all on "subPortfolioHoldings";
create policy sub_holdings_all on "subPortfolioHoldings" for all to authenticated
  using (user_id = auth.uid() or public.investor_is_staff())
  with check (user_id = auth.uid() or public.investor_is_staff());

-- portfolioSnapshots ------------------------------------------------------
drop policy if exists snapshots_select on "portfolioSnapshots";
create policy snapshots_select on "portfolioSnapshots" for select to authenticated
  using (user_id = auth.uid() or public.investor_is_staff());

-- CRM tables (staff-only by rule) -----------------------------------------
drop policy if exists crm_leads_staff on "crmLeads";
create policy crm_leads_staff on "crmLeads" for all to authenticated
  using (public.investor_is_staff()) with check (public.investor_is_staff());
drop policy if exists crm_imports_staff on "crmImports";
create policy crm_imports_staff on "crmImports" for all to authenticated
  using (public.investor_is_staff()) with check (public.investor_is_staff());
drop policy if exists crm_suppression_staff on "crmSuppression";
create policy crm_suppression_staff on "crmSuppression" for all to authenticated
  using (public.investor_is_staff()) with check (public.investor_is_staff());
drop policy if exists crm_instruments_staff on "crmInstruments";
create policy crm_instruments_staff on "crmInstruments" for all to authenticated
  using (public.investor_is_staff()) with check (public.investor_is_staff());
drop policy if exists crm_campaigns_staff on "crmCampaigns";
create policy crm_campaigns_staff on "crmCampaigns" for all to authenticated
  using (public.investor_is_staff()) with check (public.investor_is_staff());
drop policy if exists crm_enrollments_staff on "crmEnrollments";
create policy crm_enrollments_staff on "crmEnrollments" for all to authenticated
  using (public.investor_is_staff()) with check (public.investor_is_staff());
drop policy if exists crm_inbound_staff on "crmInbound";
create policy crm_inbound_staff on "crmInbound" for all to authenticated
  using (public.investor_is_staff()) with check (public.investor_is_staff());

-- counters ----------------------------------------------------------------
drop policy if exists counters_all on "counters";
create policy counters_all on "counters" for all to authenticated
  using (true) with check (true);

-- ============================================================= realtime
-- The realtime publication must include the tables the services subscribe to.
-- Table names must be quoted exactly; ignore "already member" errors.

do $$
begin
  alter publication supabase_realtime add table "wallets";
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table "fundingRequests";
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table "clientNotifications";
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table "staffNotifications";
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table "assets";
exception when duplicate_object then null; end $$;

-- ============================================================= storage buckets
-- getPublicUrl() is used for all three, so the buckets are public. KYC docs
-- and payment proofs are sensitive - revisit with signed URLs before launch.

insert into storage.buckets (id, name, public)
values
  ('payment-proofs', 'payment-proofs', true),
  ('kyc-documents',  'kyc-documents',  true),
  ('crm-imports',    'crm-imports',    true),
  ('branding',       'branding',       true)
on conflict (id) do nothing;

drop policy if exists sg_storage_insert on storage.objects;
create policy sg_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('payment-proofs', 'kyc-documents', 'crm-imports', 'branding'));
drop policy if exists sg_storage_update on storage.objects;
create policy sg_storage_update on storage.objects for update to authenticated
  using (bucket_id in ('payment-proofs', 'kyc-documents', 'crm-imports', 'branding'))
  with check (bucket_id in ('payment-proofs', 'kyc-documents', 'crm-imports', 'branding'));
drop policy if exists sg_storage_delete on storage.objects;
create policy sg_storage_delete on storage.objects for delete to authenticated
  using (bucket_id in ('payment-proofs', 'kyc-documents', 'crm-imports', 'branding'));

-- ============================================================= seed: asset catalog
-- Ported from scripts/seed-asset-catalog.mjs (was Firebase/Firestore).

insert into "assetGroups" (id, "label", "assetClass", "parentLabel", "sortOrder") values
  ('energies',        'Energies',                'commodity_future', 'Commodities & Futures', 1),
  ('metals',          'Metals',                  'commodity_future', 'Commodities & Futures', 2),
  ('grains',          'Grains',                  'commodity_future', 'Commodities & Futures', 3),
  ('softs',           'Softs',                   'commodity_future', 'Commodities & Futures', 4),
  ('livestock',       'Livestock',               'commodity_future', 'Commodities & Futures', 5),
  ('financials',      'Financials',              'commodity_future', 'Commodities & Futures', 6),
  ('currencies',      'Currencies',              'commodity_future', 'Commodities & Futures', 7),
  ('futures-indices', 'Indices',                 'commodity_future', 'Commodities & Futures', 8),
  ('benchmark-index', 'Benchmark Indices',       'benchmark_index',  'Stocks & Shares',       9),
  ('dow30',           'Dow 30',                  'equity',           'Stocks & Shares',       10),
  ('sector-leader',   'Sector Leaders',          'equity',           'Stocks & Shares',       11),
  ('etf',             'ETFs',                    'etf',              'Stocks & Shares',       12),
  ('fx-majors',       'FX Majors',               'fx',               'Forex',                 13),
  ('fx-crosses',      'FX Crosses',              'fx',               'Forex',                 14),
  ('crypto-major',    'Major Cryptocurrencies',  'crypto',           'Cryptocurrency',        15),
  ('crypto-alt',      'Altcoins',                'crypto',           'Cryptocurrency',        16)
on conflict (id) do update set
  "label" = excluded."label",
  "assetClass" = excluded."assetClass",
  "parentLabel" = excluded."parentLabel",
  "sortOrder" = excluded."sortOrder";

insert into "assets" (id, symbol, "name", "assetClass", "groupId", "exchange", "contractUnit", "quoteSymbol", "priority", "is_tradable", "dataProvider") values
  -- Futures (core tier, sourced from barchart.com contract specs)
  ('CL',    'CL',    'Crude Oil WTI',            'commodity_future', 'energies',        'NYMEX',      '1,000 barrels',    'USO',  'core', true, 'finnhub'),
  ('BZ',    'BZ',    'Crude Oil Brent',          'commodity_future', 'energies',        'NYMEX',      '1,000 barrels',    'BNO',  'core', true, 'finnhub'),
  ('NG',    'NG',    'Natural Gas',              'commodity_future', 'energies',        'NYMEX',      '10,000 MMBtu',     'UNG',  'core', true, 'finnhub'),
  ('GC',    'GC',    'Gold',                     'commodity_future', 'metals',          'COMEX',      '100 troy oz',      'GLD',  'core', true, 'finnhub'),
  ('SI',    'SI',    'Silver',                   'commodity_future', 'metals',          'COMEX',      '5,000 troy oz',    'SLV',  'core', true, 'finnhub'),
  ('HG',    'HG',    'High Grade Copper',        'commodity_future', 'metals',          'COMEX',      '25,000 lbs',       'CPER', 'core', true, 'finnhub'),
  ('PL',    'PL',    'Platinum',                 'commodity_future', 'metals',          'NYMEX',      '50 troy oz',       'PPLT', 'core', true, 'finnhub'),
  ('ZC',    'ZC',    'Corn',                     'commodity_future', 'grains',          'CBOT',       '5,000 bushels',    'CORN', 'core', true, 'finnhub'),
  ('ZW',    'ZW',    'Wheat (Chicago SRW)',      'commodity_future', 'grains',          'CBOT',       '5,000 bushels',    'WEAT', 'core', true, 'finnhub'),
  ('ZS',    'ZS',    'Soybeans',                 'commodity_future', 'grains',          'CBOT',       '5,000 bushels',    'SOYB', 'core', true, 'finnhub'),
  ('KC',    'KC',    'Coffee',                   'commodity_future', 'softs',           'ICE US',     '37,500 lbs',       'JO',   'core', true, 'finnhub'),
  ('CC',    'CC',    'Cocoa',                    'commodity_future', 'softs',           'ICE US',     '10 metric tons',   'NIB',  'core', true, 'finnhub'),
  ('SB',    'SB',    'Sugar #11',                'commodity_future', 'softs',           'ICE US',     '112,000 lbs',      'CANE', 'core', true, 'finnhub'),
  ('CT',    'CT',    'Cotton #2',                'commodity_future', 'softs',           'ICE US',     '50,000 lbs',       'BAL',  'core', true, 'finnhub'),
  ('LE',    'LE',    'Live Cattle',              'commodity_future', 'livestock',       'CME',        '40,000 lbs',       'COW',  'core', true, 'finnhub'),
  ('GF',    'GF',    'Feeder Cattle',            'commodity_future', 'livestock',       'CME',        '50,000 lbs',       null,   'core', true, 'finnhub'),
  ('HE',    'HE',    'Lean Hogs',                'commodity_future', 'livestock',       'CME',        '40,000 lbs',       null,   'core', true, 'finnhub'),
  ('ZB',    'ZB',    '30-Year T-Bond',           'commodity_future', 'financials',      'CBOT',       '$100,000 face',    'TLT',  'core', true, 'finnhub'),
  ('ZN',    'ZN',    '10-Year T-Note',           'commodity_future', 'financials',      'CBOT',       '$100,000 face',    'IEF',  'core', true, 'finnhub'),
  ('DX',    'DX',    'US Dollar Index',          'commodity_future', 'currencies',      'ICE US',     '$1,000 x Index',   'UUP',  'core', true, 'finnhub'),
  ('E6',    'E6',    'Euro FX',                  'commodity_future', 'currencies',      'CME',        'EUR125,000',       'FXE',  'core', true, 'finnhub'),
  ('B6',    'B6',    'British Pound',            'commodity_future', 'currencies',      'CME',        'GBP62,500',        'FXB',  'core', true, 'finnhub'),
  ('J6',    'J6',    'Japanese Yen',             'commodity_future', 'currencies',      'CME',        'JPY12,500,000',    'FXY',  'core', true, 'finnhub'),
  ('ES',    'ES',    'S&P 500 E-Mini',           'commodity_future', 'futures-indices', 'CME Globex', '$50 x Index',      'SPY',  'core', true, 'finnhub'),
  ('NQ',    'NQ',    'Nasdaq 100 E-Mini',        'commodity_future', 'futures-indices', 'CME Globex', '$20 x Index',      'QQQ',  'core', true, 'finnhub'),
  ('YM',    'YM',    'Dow Futures Mini',         'commodity_future', 'futures-indices', 'CBOT',       '$5 x Index',       'DIA',  'core', true, 'finnhub'),
  -- Benchmark indices (reference-only, not tradable)
  ('^GSPC', '^GSPC', 'S&P 500',                          'benchmark_index', 'benchmark-index', null, null, 'SPY', 'core', false, 'finnhub'),
  ('^DJI',  '^DJI',  'Dow Jones Industrial Average',     'benchmark_index', 'benchmark-index', null, null, 'DIA', 'core', false, 'finnhub'),
  ('^IXIC', '^IXIC', 'Nasdaq Composite',                 'benchmark_index', 'benchmark-index', null, null, 'QQQ', 'core', false, 'finnhub'),
  ('^RUT',  '^RUT',  'Russell 2000',                     'benchmark_index', 'benchmark-index', null, null, 'IWM', 'core', false, 'finnhub'),
  -- Dow 30
  ('AAPL', 'AAPL', 'Apple Inc.',                                  'equity', 'dow30', null, null, 'AAPL', 'core', true, 'finnhub'),
  ('MSFT', 'MSFT', 'Microsoft Corporation',                       'equity', 'dow30', null, null, 'MSFT', 'core', true, 'finnhub'),
  ('NVDA', 'NVDA', 'NVIDIA Corporation',                          'equity', 'dow30', null, null, 'NVDA', 'core', true, 'finnhub'),
  ('CRM',  'CRM',  'Salesforce, Inc.',                            'equity', 'dow30', null, null, 'CRM',  'core', true, 'finnhub'),
  ('CSCO', 'CSCO', 'Cisco Systems, Inc.',                         'equity', 'dow30', null, null, 'CSCO', 'core', true, 'finnhub'),
  ('IBM',  'IBM',  'International Business Machines Corp.',       'equity', 'dow30', null, null, 'IBM',  'core', true, 'finnhub'),
  ('AMZN', 'AMZN', 'Amazon.com, Inc.',                            'equity', 'dow30', null, null, 'AMZN', 'core', true, 'finnhub'),
  ('HD',   'HD',   'The Home Depot, Inc.',                        'equity', 'dow30', null, null, 'HD',   'core', true, 'finnhub'),
  ('MCD',  'MCD',  'McDonald''s Corporation',                     'equity', 'dow30', null, null, 'MCD',  'core', true, 'finnhub'),
  ('NKE',  'NKE',  'Nike, Inc.',                                  'equity', 'dow30', null, null, 'NKE',  'core', true, 'finnhub'),
  ('AMGN', 'AMGN', 'Amgen Inc.',                                  'equity', 'dow30', null, null, 'AMGN', 'core', true, 'finnhub'),
  ('JNJ',  'JNJ',  'Johnson & Johnson',                           'equity', 'dow30', null, null, 'JNJ',  'core', true, 'finnhub'),
  ('MRK',  'MRK',  'Merck & Co., Inc.',                           'equity', 'dow30', null, null, 'MRK',  'core', true, 'finnhub'),
  ('UNH',  'UNH',  'UnitedHealth Group Incorporated',             'equity', 'dow30', null, null, 'UNH',  'core', true, 'finnhub'),
  ('AXP',  'AXP',  'American Express Company',                    'equity', 'dow30', null, null, 'AXP',  'core', true, 'finnhub'),
  ('GS',   'GS',   'The Goldman Sachs Group, Inc.',               'equity', 'dow30', null, null, 'GS',   'core', true, 'finnhub'),
  ('JPM',  'JPM',  'JPMorgan Chase & Co.',                        'equity', 'dow30', null, null, 'JPM',  'core', true, 'finnhub'),
  ('TRV',  'TRV',  'The Travelers Companies, Inc.',               'equity', 'dow30', null, null, 'TRV',  'core', true, 'finnhub'),
  ('V',    'V',    'Visa Inc.',                                   'equity', 'dow30', null, null, 'V',    'core', true, 'finnhub'),
  ('BA',   'BA',   'The Boeing Company',                          'equity', 'dow30', null, null, 'BA',   'core', true, 'finnhub'),
  ('CAT',  'CAT',  'Caterpillar Inc.',                            'equity', 'dow30', null, null, 'CAT',  'core', true, 'finnhub'),
  ('HON',  'HON',  'Honeywell International Inc.',                'equity', 'dow30', null, null, 'HON',  'core', true, 'finnhub'),
  ('MMM',  'MMM',  '3M Company',                                  'equity', 'dow30', null, null, 'MMM',  'core', true, 'finnhub'),
  ('CVX',  'CVX',  'Chevron Corporation',                         'equity', 'dow30', null, null, 'CVX',  'core', true, 'finnhub'),
  ('DIS',  'DIS',  'The Walt Disney Company',                     'equity', 'dow30', null, null, 'DIS',  'core', true, 'finnhub'),
  ('VZ',   'VZ',   'Verizon Communications Inc.',                 'equity', 'dow30', null, null, 'VZ',   'core', true, 'finnhub'),
  ('KO',   'KO',   'The Coca-Cola Company',                       'equity', 'dow30', null, null, 'KO',   'core', true, 'finnhub'),
  ('PG',   'PG',   'The Procter & Gamble Company',                'equity', 'dow30', null, null, 'PG',   'core', true, 'finnhub'),
  ('WMT',  'WMT',  'Walmart Inc.',                                'equity', 'dow30', null, null, 'WMT',  'core', true, 'finnhub'),
  ('SHW',  'SHW',  'The Sherwin-Williams Company',                'equity', 'dow30', null, null, 'SHW',  'core', true, 'finnhub'),
  -- Sector leaders
  ('AVGO',  'AVGO',  'Broadcom Inc.',                     'equity', 'sector-leader', null, null, 'AVGO',  'core', true, 'finnhub'),
  ('ORCL',  'ORCL',  'Oracle Corporation',                'equity', 'sector-leader', null, null, 'ORCL',  'core', true, 'finnhub'),
  ('LLY',   'LLY',   'Eli Lilly and Company',             'equity', 'sector-leader', null, null, 'LLY',   'core', true, 'finnhub'),
  ('ABBV',  'ABBV',  'AbbVie Inc.',                       'equity', 'sector-leader', null, null, 'ABBV',  'core', true, 'finnhub'),
  ('PFE',   'PFE',   'Pfizer Inc.',                       'equity', 'sector-leader', null, null, 'PFE',   'core', true, 'finnhub'),
  ('MA',    'MA',    'Mastercard Incorporated',           'equity', 'sector-leader', null, null, 'MA',    'core', true, 'finnhub'),
  ('BAC',   'BAC',   'Bank of America Corporation',       'equity', 'sector-leader', null, null, 'BAC',   'core', true, 'finnhub'),
  ('WFC',   'WFC',   'Wells Fargo & Company',             'equity', 'sector-leader', null, null, 'WFC',   'core', true, 'finnhub'),
  ('TSLA',  'TSLA',  'Tesla, Inc.',                       'equity', 'sector-leader', null, null, 'TSLA',  'core', true, 'finnhub'),
  ('LOW',   'LOW',   'Lowe''s Companies, Inc.',           'equity', 'sector-leader', null, null, 'LOW',   'core', true, 'finnhub'),
  ('COST',  'COST',  'Costco Wholesale Corporation',      'equity', 'sector-leader', null, null, 'COST',  'core', true, 'finnhub'),
  ('PEP',   'PEP',   'PepsiCo, Inc.',                     'equity', 'sector-leader', null, null, 'PEP',   'core', true, 'finnhub'),
  ('XOM',   'XOM',   'Exxon Mobil Corporation',           'equity', 'sector-leader', null, null, 'XOM',   'core', true, 'finnhub'),
  ('COP',   'COP',   'ConocoPhillips',                    'equity', 'sector-leader', null, null, 'COP',   'core', true, 'finnhub'),
  ('GE',    'GE',    'GE Aerospace',                      'equity', 'sector-leader', null, null, 'GE',    'core', true, 'finnhub'),
  ('RTX',   'RTX',   'RTX Corporation',                   'equity', 'sector-leader', null, null, 'RTX',   'core', true, 'finnhub'),
  ('NEE',   'NEE',   'NextEra Energy, Inc.',              'equity', 'sector-leader', null, null, 'NEE',   'core', true, 'finnhub'),
  ('SO',    'SO',    'The Southern Company',              'equity', 'sector-leader', null, null, 'SO',    'core', true, 'finnhub'),
  ('PLD',   'PLD',   'Prologis, Inc.',                    'equity', 'sector-leader', null, null, 'PLD',   'core', true, 'finnhub'),
  ('AMT',   'AMT',   'American Tower Corporation',        'equity', 'sector-leader', null, null, 'AMT',   'core', true, 'finnhub'),
  ('LIN',   'LIN',   'Linde plc',                         'equity', 'sector-leader', null, null, 'LIN',   'core', true, 'finnhub'),
  ('FCX',   'FCX',   'Freeport-McMoRan Inc.',             'equity', 'sector-leader', null, null, 'FCX',   'core', true, 'finnhub'),
  ('GOOGL', 'GOOGL', 'Alphabet Inc. (Class A)',           'equity', 'sector-leader', null, null, 'GOOGL', 'core', true, 'finnhub'),
  ('META',  'META',  'Meta Platforms, Inc.',              'equity', 'sector-leader', null, null, 'META',  'core', true, 'finnhub'),
  ('NFLX',  'NFLX',  'Netflix, Inc.',                     'equity', 'sector-leader', null, null, 'NFLX',  'core', true, 'finnhub'),
  -- ETFs
  ('SPY', 'SPY', 'SPDR S&P 500 ETF Trust',                      'etf', 'etf', null, null, 'SPY', 'core', true, 'finnhub'),
  ('VOO', 'VOO', 'Vanguard S&P 500 ETF',                        'etf', 'etf', null, null, 'VOO', 'core', true, 'finnhub'),
  ('VTI', 'VTI', 'Vanguard Total Stock Market ETF',             'etf', 'etf', null, null, 'VTI', 'core', true, 'finnhub'),
  ('QQQ', 'QQQ', 'Invesco QQQ Trust',                           'etf', 'etf', null, null, 'QQQ', 'core', true, 'finnhub'),
  ('DIA', 'DIA', 'SPDR Dow Jones Industrial Average ETF',       'etf', 'etf', null, null, 'DIA', 'core', true, 'finnhub'),
  ('IWM', 'IWM', 'iShares Russell 2000 ETF',                    'etf', 'etf', null, null, 'IWM', 'core', true, 'finnhub'),
  ('XLE', 'XLE', 'Energy Select Sector SPDR Fund',              'etf', 'etf', null, null, 'XLE', 'core', true, 'finnhub'),
  ('XLF', 'XLF', 'Financial Select Sector SPDR Fund',           'etf', 'etf', null, null, 'XLF', 'core', true, 'finnhub'),
  ('XLK', 'XLK', 'Technology Select Sector SPDR Fund',          'etf', 'etf', null, null, 'XLK', 'core', true, 'finnhub'),
  ('XLV', 'XLV', 'Health Care Select Sector SPDR Fund',         'etf', 'etf', null, null, 'XLV', 'core', true, 'finnhub'),
  ('XLY', 'XLY', 'Consumer Discretionary Select Sector SPDR',   'etf', 'etf', null, null, 'XLY', 'core', true, 'finnhub'),
  ('XLI', 'XLI', 'Industrial Select Sector SPDR Fund',          'etf', 'etf', null, null, 'XLI', 'core', true, 'finnhub'),
  ('ARKK','ARKK','ARK Innovation ETF',                          'etf', 'etf', null, null, 'ARKK','core', true, 'finnhub'),
  ('GLD', 'GLD', 'SPDR Gold Shares',                            'etf', 'etf', null, null, 'GLD', 'core', true, 'finnhub'),
  -- FX majors (Finnhub OANDA symbols)
  ('EURUSD', 'EURUSD', 'Euro / US Dollar',             'fx', 'fx-majors',  'FOREX', null, 'OANDA:EUR_USD', 'core', true, 'finnhub'),
  ('GBPUSD', 'GBPUSD', 'British Pound / US Dollar',    'fx', 'fx-majors',  'FOREX', null, 'OANDA:GBP_USD', 'core', true, 'finnhub'),
  ('USDJPY', 'USDJPY', 'US Dollar / Japanese Yen',     'fx', 'fx-majors',  'FOREX', null, 'OANDA:USD_JPY', 'core', true, 'finnhub'),
  ('USDCHF', 'USDCHF', 'US Dollar / Swiss Franc',      'fx', 'fx-majors',  'FOREX', null, 'OANDA:USD_CHF', 'core', true, 'finnhub'),
  ('USDCAD', 'USDCAD', 'US Dollar / Canadian Dollar',  'fx', 'fx-majors',  'FOREX', null, 'OANDA:USD_CAD', 'core', true, 'finnhub'),
  ('AUDUSD', 'AUDUSD', 'Australian Dollar / US Dollar','fx', 'fx-majors',  'FOREX', null, 'OANDA:AUD_USD', 'core', true, 'finnhub'),
  ('NZDUSD', 'NZDUSD', 'New Zealand Dollar / US Dollar','fx','fx-majors',  'FOREX', null, 'OANDA:NZD_USD', 'core', true, 'finnhub'),
  -- FX crosses
  ('EURGBP', 'EURGBP', 'Euro / British Pound',        'fx', 'fx-crosses', 'FOREX', null, 'OANDA:EUR_GBP', 'core', true, 'finnhub'),
  ('EURJPY', 'EURJPY', 'Euro / Japanese Yen',         'fx', 'fx-crosses', 'FOREX', null, 'OANDA:EUR_JPY', 'core', true, 'finnhub'),
  ('GBPJPY', 'GBPJPY', 'British Pound / Japanese Yen','fx', 'fx-crosses', 'FOREX', null, 'OANDA:GBP_JPY', 'core', true, 'finnhub'),
  ('EURAUD', 'EURAUD', 'Euro / Australian Dollar',    'fx', 'fx-crosses', 'FOREX', null, 'OANDA:EUR_AUD', 'core', true, 'finnhub'),
  ('AUDJPY', 'AUDJPY', 'Australian Dollar / Japanese Yen','fx','fx-crosses','FOREX',null, 'OANDA:AUD_JPY', 'core', true, 'finnhub'),
  -- Crypto majors (Finnhub BINANCE symbols)
  ('BTCUSD', 'BTCUSD', 'Bitcoin',   'crypto', 'crypto-major', 'CRYPTO', null, 'BINANCE:BTCUSDT', 'core', true, 'finnhub'),
  ('ETHUSD', 'ETHUSD', 'Ethereum',  'crypto', 'crypto-major', 'CRYPTO', null, 'BINANCE:ETHUSDT', 'core', true, 'finnhub'),
  ('SOLUSD', 'SOLUSD', 'Solana',    'crypto', 'crypto-major', 'CRYPTO', null, 'BINANCE:SOLUSDT', 'core', true, 'finnhub'),
  ('XRPUSD', 'XRPUSD', 'XRP',       'crypto', 'crypto-major', 'CRYPTO', null, 'BINANCE:XRPUSDT', 'core', true, 'finnhub'),
  ('BNBUSD', 'BNBUSD', 'BNB',       'crypto', 'crypto-major', 'CRYPTO', null, 'BINANCE:BNBUSDT', 'core', true, 'finnhub'),
  -- Crypto alts
  ('ADAUSD', 'ADAUSD', 'Cardano',    'crypto', 'crypto-alt', 'CRYPTO', null, 'BINANCE:ADAUSDT',  'core', true, 'finnhub'),
  ('DOGEUSD','DOGEUSD','Dogecoin',   'crypto', 'crypto-alt', 'CRYPTO', null, 'BINANCE:DOGEUSDT', 'core', true, 'finnhub'),
  ('DOTUSD', 'DOTUSD', 'Polkadot',   'crypto', 'crypto-alt', 'CRYPTO', null, 'BINANCE:DOTUSDT',  'core', true, 'finnhub'),
  ('AVAXUSD','AVAXUSD','Avalanche',  'crypto', 'crypto-alt', 'CRYPTO', null, 'BINANCE:AVAXUSDT', 'core', true, 'finnhub'),
  ('LINKUSD','LINKUSD','Chainlink',  'crypto', 'crypto-alt', 'CRYPTO', null, 'BINANCE:LINKUSDT', 'core', true, 'finnhub')
on conflict (id) do update set
  symbol = excluded.symbol,
  "name" = excluded."name",
  "assetClass" = excluded."assetClass",
  "groupId" = excluded."groupId",
  "exchange" = excluded."exchange",
  "contractUnit" = excluded."contractUnit",
  "quoteSymbol" = excluded."quoteSymbol",
  "priority" = excluded."priority",
  is_tradable = excluded.is_tradable,
  "dataProvider" = excluded."dataProvider";

-- Default platform settings rows (values are managed in Admin -> Settings).
insert into "platformSettings" (id, updated_at)
values ('global', now()), ('fundingDetails', now())
on conflict (id) do nothing;

-- ============================================================================
-- NOT created here (zero browser usage; shape server-side when needed):
--   walletTransactions, cashLedger (RPC-managed), crmEmailEvents, crmSources
--
-- RPCs referenced by the code but NOT defined here (deploy separately):
--   confirm_funding_receipt, record_client_deposit, backfill_deposit_ledger,
--   place_order_on_behalf, fill_order, mark_order_working, reject_order,
--   cancel_order, update_trade_contract, generate_account_statement,
--   run_portfolio_snapshot_now
-- ============================================================================
