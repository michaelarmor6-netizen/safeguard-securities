# Supabase Schema Draft (from code usage)

**DRAFT — generated from static analysis of `src/`, primarily `src/services/investor/*.ts`.**
Source of table names: `src/config/liveCollections.ts` (`LIVE_COLLECTIONS`).

Notation per column: **R** = read (field accessed on returned rows), **W** = written
(`insert` / `update` / `upsert` payload), **F** = filtered or ordered (`.eq/.in/.neq/.order`).
Casing shown is the EXACT string used in code.

> ⚠️ **Key migration hazard found throughout the code**: reads are camelCase-only in several
> mappers (Firestore heritage) while writes/filters are snake_case in the same file. Every such
> conflict is flagged per table. See “Naming inconsistency summary” at the end.

Note on table names: `LIVE_COLLECTIONS.orders → 'adminOrders'` and
`LIVE_COLLECTIONS.settings → 'platformSettings'`. All other keys equal the table name.
An extra table `crmEnrollments` exists in `LIVE_COLLECTIONS` (not in the requested list) and IS
used — covered below.

---

## Table index

| Table (LIVE_COLLECTIONS key) | Used in | Status |
|---|---|---|
| profiles | profileService, subscriptionService | ✅ |
| wallets | walletService | ✅ |
| watchlists | watchlistService | ✅ |
| portfolioHoldings | portfolioService, tradingService | ✅ |
| fundingRequests | fundingService | ✅ |
| invoices | invoiceService | ✅ |
| clientNotifications | clientNotificationService, invoiceService | ✅ |
| staffNotifications | staffNotificationService, invoiceService | ✅ |
| adminOrders (key: `orders`) | orderService, portfolioService, tradingService | ✅ |
| priceAlerts | priceAlertService | ✅ |
| trades | tradesService, tradingService | ✅ |
| walletTransactions | — | ⛔ **zero usage** |
| platformSettings (key: `settings`) | settingsService, fundingDetailsService | ✅ |
| supportTickets | ticketService | ✅ |
| auditLogs | auditService | ✅ |
| kycSubmissions | kycService | ✅ |
| kycDocuments | kycService | ✅ |
| strategies | strategyService | ✅ |
| aiSignals | aiSignalService | ✅ |
| aiUsage | subscriptionService | ✅ (read-only in browser; written by backend) |
| planRequests | subscriptionService | ✅ |
| referralCodes | referralService | ✅ |
| referrals | referralService | ✅ |
| assetGroups | assetCatalogService | ✅ |
| assets | assetCatalogService, orderService | ✅ |
| cashLedger | — | ⛔ **zero usage** (RPC-managed) |
| subPortfolios | subPortfolioService | ✅ |
| subPortfolioHoldings | subPortfolioService | ✅ |
| portfolioSnapshots | portfolioHistoryService | ✅ (read-only in browser; written by RPC) |
| crmLeads | crmLeadService, crmGiInboxService | ✅ |
| crmImports | crmImportService | ✅ |
| crmSuppression | crmSuppressionService | ✅ |
| crmInstruments | crmInstrumentService | ✅ |
| crmCampaigns | crmCampaignService | ✅ |
| crmEnrollments | crmCampaignService | ✅ |
| crmEmailEvents | — | ⛔ **zero usage** in `src/` (likely written by `functions-crm` worker) |
| crmInbound | crmGiInboxService | ✅ (browser only updates; insert done by webhook outside `src/`) |
| crmSources | — | ⛔ **zero usage** |

Auxiliary table used by investor flows (not in LIVE_COLLECTIONS): **`counters`** —
`fundingService.createFundingRequest` and `invoiceService` read/`upsert` `{ id: text, value: number }`.
No other legacy bank tables (`users`, `accounts`, `system_config`, `support_requests`, `faqs`,
`countries`, `transfers`, …) are touched by the investor platform.

Pages never query LIVE_COLLECTIONS tables directly — they consume the service mappers, so all
column access is captured by the services above.

---

## 1. `profiles`

Usage: `services/investor/profileService.ts` (all reads/writes), `subscriptionService.setPlanForUser` (write).

- `id` — F (`eq('id', uid)`, delete eq id) — equals the auth uid (inserted explicitly: `id: uid`)
- `email` — R (`data.email`), W (camel)
- `username` — R (camel)
- `firstName` — R/W (camel) (also part of onboarding spread)
- `lastName` — R/W (camel)
- `displayName` — R/W (camel)
- `phone` — R/W (camel) (onboarding spread)
- `role` — R/W (camel spelling; same in both)
- `accountStatus` — R (`data.accountStatus`), W (camel) — ⚠️ **also filtered as `account_status`** (`getPendingApplicants`)
- `investorTier` — R/W (camel)
- `createdAt` — R (`data.createdAt`), W (camel, insert) — ⚠️ **also ordered as `created_at`** (`getAllInvestorProfiles`)
- `updatedAt` — W (camel, `ensureInvestorProfile`) — ⚠️ **also written as `updated_at`** (snake) in `updateInvestorProfile`, `skipOnboarding`, `submitClientOnboarding`, `setPlanForUser`; never read
- `planSince` — R (camel) — ⚠️ **written as `plan_since`** (snake) in `setPlanForUser`
- `plan` — R/W (same spelling both ways)
- `onboardingCompleted` — R/W (camel)
- `onboardingCompletedAt` — R/W (camel)
- `onboardingSkipped` — R/W (camel)
- `onboardingSource` — R/W (camel)
- `createdBy` — R (camel)
- `middleName` — R/W (camel) (onboarding spread)
- `dateOfBirth` — R/W (camel) (onboarding spread)
- `gender` — R/W (camel) (onboarding spread)
- `address` — R/W (camel, nested object → jsonb)
- `citizenship` — R/W (camel) (onboarding spread)
- `residencyCountry` — R/W (camel) (onboarding spread)
- `idType` — R/W (camel) (onboarding spread)
- `employment` — R/W (camel, jsonb)
- `investmentProfile` — R/W (camel, jsonb)
- `compliance` — R/W (camel, jsonb)
- `accountManager` — R/W (camel, jsonb)

**Inconsistencies (critical):**
1. `accountStatus` written camel, filtered `account_status` snake → `getPendingApplicants` returns nothing unless both columns exist.
2. `createdAt` written camel, ordered `created_at` snake → `getAllInvestorProfiles` order fails (PostgREST error → empty list) unless both exist.
3. `updatedAt` AND `updated_at` both written by different functions.
4. `planSince` read camel, written `plan_since` snake.

## 2. `wallets`

Usage: `services/investor/walletService.ts`.

- `id` — R (no id written on insert → server default)
- `userId` — R (`data?.userId`, **camel only**) — ⚠️ stored/written/filtered as `user_id`
- `user_id` — F (`eq('user_id', …)`), W (snake, insert)
- `balance` — R/W (default 0; browser no longer writes balances — RPC only)
- `currency` — R/W (default `'USD'`)
- `label` — R/W
- `status` — W (`'active'` on insert; never read)
- `created_at` — W (snake)

**Inconsistency:** `mapWallet` reads `data?.userId` but rows store `user_id` → `userId` is always `''` in the UI. Realtime channel filters on `user_id`.

**Realtime:** channel `wallet-{userId}`, `postgres_changes` on table `wallets`, `filter: user_id=eq.{userId}`.

## 3. `watchlists`

Usage: `services/investor/watchlistService.ts`. Consistent snake_case.

- `id` — F (`eq('id', userId)`), W (upsert, = auth uid → **uuid**) — one row per user
- `user_id` — W (snake, = auth uid)
- `symbols` — R/W (array of uppercase tickers → `text[]`)
- `updated_at` — W (snake)

## 4. `portfolioHoldings`

Usage: `services/investor/portfolioService.ts`, `tradingService.ts`.

- `id` — F (`eq('id', …)`)
- `userId` — R (`data.userId`, camel) — ⚠️ **filtered as `user_id`** (`eq('user_id', …)`)
- `symbol` — R (also filtered client-side after read; not an SQL filter)
- `name` — R (camel)
- `shares` — R (camel; fallback `quantity`) — RPC-written (casing unknown), browser never inserts holdings
- `quantity` — R (camel, fallback for `shares`)
- `avgCost` — R (camel; fallbacks `averagePrice`, `avgPrice`)
- `currentPrice` — R (camel; fallback `price`)
- `sector` — R (camel)
- `assetId` — R (camel)
- `entryUnderlyingPrice` — R (camel) — ⚠️ **written as `entry_underlying_price`** (snake, `correctPositionTerms`)
- `multiplier` — R (camel; fallback `contractSize`)
- `strikePrice` — R (camel) — ⚠️ **written as `strike_price`** (snake, `correctPositionTerms`)
- `optionType` — R (camel)
- `manualPnl` — R (camel) — ⚠️ **written as `manual_pnl`** (snake, `setHoldingManualPnl`)
- `manualPnlAsOf` — R (camel) — ⚠️ **written as `manual_pnl_as_of`** (snake)
- `updated_at` — W (snake)

**Inconsistencies (critical):** browser writes `manual_pnl` / `strike_price` / `entry_underlying_price` snake but the reader only looks for camelCase `manualPnl` / `strikePrice` / `entryUnderlyingPrice`; `userId` read camel vs `user_id` filter.

## 5. `fundingRequests`

Usage: `services/investor/fundingService.ts`. Fully snake_case — clean.

- `id` — F (`eq('id', …)`)
- `user_id` — R/F/W (snake; `eq('user_id', …)`)
- `user_email` — R/W
- `amount` — R/W (numeric)
- `status` — R/F (`eq('status','pending')`)/W (`pending|approved|funded|rejected`)
- `reference` — R/W (e.g. `SG-FUND2600001`)
- `awaiting_payment` — R/W (boolean)
- `created_at` — R/W/F (`order('created_at')`)
- `updated_at` — W
- `approved_at` — R/W
- `funded_at` — R/W (written by RPC `confirm_funding_receipt`)
- `payment_claimed_at` — R/W
- `payment_proofs` — R/W (jsonb array of `{name,url,path,size,content_type,uploaded_at}`)
- `email_sent_at` — R/W
- `email_error` — R/W (nullable)
- `source` — R (`'client' | 'admin'`)
- `note` — R/W (written by RPC `record_client_deposit`)
- `recorded_by_email` — R
- `recorded_by_uid` — R

**Realtime:** channel `funding-requests-{userId}`, table `fundingRequests`, `filter: user_id=eq.{userId}`.

## 6. `invoices`

Usage: `services/investor/invoiceService.ts`. Fully snake_case — clean.

- `id` — F, R (insert `.select('id').single()`)
- `number` — R/W
- `user_id` — R/F/W (`eq('user_id', …)`)
- `bill_to_name` / `bill_to_email` / `bill_to_company` / `bill_to_address` — R/W
- `currency` — R/W (default `'USD'`)
- `line_items` — R/W (jsonb array `{description, quantity, unitPrice}` — note **nested key `unitPrice` is camelCase inside the jsonb**)
- `tax_rate` — R/W (numeric)
- `tax_label` — R/W
- `notes` — R/W
- `payment_terms` — R/W
- `due_date` — R/W (Date → timestamptz)
- `include_payment_instructions` — R/W (boolean)
- `send_mode` — R/W (`'auto' | 'manual'`)
- `status` — R/W (`issued|sent|paid|void`)
- `issued_at` — R/W
- `created_at` — R/W/F (`order('created_at')`)
- `updated_at` — W
- `created_by_uid` — R/W (uuid)
- `created_by_email` — R/W
- `email_sent_at` / `email_error` — R/W
- `payment_claimed_at` — R/W
- `payment_proofs` — R/W (jsonb)
- `paid_at` — R/W

## 7. `clientNotifications`

Usage: `services/investor/clientNotificationService.ts`, `invoiceService` (insert). Snake_case — clean.

- `id` — F (`eq('id', …)`)
- `user_id` — R/F/W (`eq('user_id', …)`)
- `type` — R/W (`'invoice'`)
- `title` — R/W
- `body` — R/W
- `href` — R/W
- `read` — R/W (boolean; ⚠️ **reserved word in SQL — must be quoted `"read"`**)
- `created_at` — R/W/F (`order('created_at')`, `.limit(40)`)
- `updated_at` — W (mark-read)

**Realtime:** channel `notices-{userId}`, table `clientNotifications`, `filter: user_id=eq.{userId}`.

## 8. `staffNotifications`

Usage: `services/investor/staffNotificationService.ts`, `invoiceService` (insert). Snake_case — clean.

- `id` — F
- `type` — R/W (`'invoice-payment'`)
- `title` / `body` / `href` — R/W
- `invoice_id` — R/W (uuid)
- `user_id` — R/W (uuid)
- `read` — R/W (boolean; quote in SQL)
- `created_at` — R/W/F (`order('created_at')`, `.limit(40)`)
- `updated_at` — W

**Realtime:** channel `staff-notices`, table `staffNotifications`, **no filter** (needs RLS-gated broadcast).

## 9. `adminOrders` (code key: `orders`)

Usage: `services/investor/orderService.ts`, `portfolioService.loadOpeningTerms`, `tradingService`.

- `id` — F (`eq('id', …)` for updates)
- `userId` — R (camel only) — ⚠️ **filtered as `user_id`** (`eq('user_id', …)`)
- `user_email` — W (snake insert) — ⚠️ read as `data.userEmail` (camel)
- `asset_id` — W (snake insert; text — assets use symbol ids)
- `symbol` — R/W (same spelling)
- `side` — R/W (`buy|sell`)
- `order_type` — W (snake insert) — ⚠️ read as `data.orderType`
- `time_in_force` — W (snake) — ⚠️ read as `data.timeInForce`
- `quantity` — R/W (numeric; same spelling)
- `status` — R/W (same; `'pending'` on client insert; RPC fills set `filled/partially_filled`)
- `filled_quantity` — W (snake) — ⚠️ read as `data.filledQuantity`
- `client_status` — W (snake) — ⚠️ read as `data.clientStatus`
- `created_at` — W (snake) + F (`order('created_at')`) — ⚠️ read as `data.createdAt`
- `limit_price`, `stop_price`, `avg_fill_price`, `price`, `rejection_reason`, `option_type`, `strike_price`⚠️, `expiry_date`, `contract_size`, `entry_underlying_price`⚠️, `delivery_type`, `fees`, `commission`, `sub_portfolio_id`, `filled_at`, `cancelled_at`
  - RPC-written (`place_order_on_behalf` / `fill_order`, casing unknown) but **read camel-only**: `limitPrice`, `stopPrice`, `avgFillPrice`, `price`, `rejectionReason`, `optionType`, `strikePrice`, `expiryDate`, `contractSize`, `entryUnderlyingPrice`, `deliveryType`, `fees`, `commission`, `subPortfolioId`, `filledAt`, `cancelledAt`
- `strike_price`, `entry_underlying_price`, `updated_at` — **W (snake)** in `tradingService.correctPositionTerms`

**Inconsistencies (critical):** the insert path writes snake_case while `mapOrder` reads camelCase-only; `correctPositionTerms` writes snake terms. Both directions break without mirror columns or a code fix.

## 10. `priceAlerts`

Usage: `services/investor/priceAlertService.ts`. Snake_case — clean (mapper has camel fallbacks).

- `id` — F (`eq('id', …)`, delete)
- `user_id` — R/F/W (`eq('user_id', …)`)
- `asset_id` — R/W (text — assets use symbol ids)
- `symbol` — R/W
- `condition` — R/W (`'above' | 'below'`)
- `target_price` — R/W (numeric)
- `status` — R/W (`active|triggered|cancelled`)
- `seen` — R/W (boolean, default true)
- `created_at` — R/W/F (`order('created_at')`)
- `updated_at` — W (not read)
- `triggered_at` / `triggered_price` — R (set by backend evaluation)

## 11. `trades`

Usage: `services/investor/tradesService.ts` (reads), `tradingService` (snake writes).

- `id` — F (`eq('id', …)` for update)
- `tradeRef` — R (camel only) — ⚠️ RPC (`fill_order`) writes; casing unknown, presumed `trade_ref`
- `orderId` — R (camel) — ⚠️ **filtered as `order_id`** (`eq('order_id', …)`)
- `userId` — R (camel) — ⚠️ **filtered as `user_id`**
- `userEmail` — R (camel)
- `assetId` — R (camel)
- `subPortfolioId` — R (camel)
- `symbol` — R/W (same)
- `side` — R (same)
- `quantity` — R (numeric)
- `price` — R (numeric)
- `grossAmount` — R (camel)
- `fees`, `commission` — R (same)
- `currency` — R
- `executedAt` — R (camel) — ⚠️ **ordered as `executed_at`** (snake)
- `remarks` — R/W (`OPEN|PARTIALLY_FILLED|CLOSED|ADJUSTED`; `'ADJUSTED'` written by `correctPositionTerms`)
- `clientStatus` — R (camel)
- `optionType` — R (camel)
- `strikePrice` — R (camel) — ⚠️ **written as `strike_price`** (snake, `correctPositionTerms`)
- `entryUnderlyingPrice` — R (camel) — ⚠️ **written as `entry_underlying_price`** (snake)
- `expiryDate`, `contractSize`, `brokerExecutionId` — R (camel)
- `updated_at` — W (snake)

**Inconsistencies (critical):** reads camel-only vs filters/writes snake (`user_id`, `order_id`, `executed_at`, `strike_price`, `entry_underlying_price`).

## 12. `walletTransactions` — ⛔ ZERO USAGE

No `.from`/`.insert` anywhere in `src/`. Money movements are derived from `fundingRequests` +
`invoices` in `transactionsService.ts`. The table is presumably written server-side (RPC
`fill_order`/`place_order_on_behalf` cash legs). **Candidate to skip** in the client-facing DDL;
if kept, shape it server-side only (suggested: `id uuid pk`, `user_id uuid`, `wallet_id uuid`,
`type text`, `amount numeric`, `reference text`, `trade_id uuid`, `created_at timestamptz`).

## 13. `platformSettings` (code key: `settings`)

Usage: `services/investor/settingsService.ts`, `fundingDetailsService.ts`. Two rows by convention:
`id='global'` (platform settings) and `id='fundingDetails'` (funding instructions).

- `id` — F (`eq('id','global'|'fundingDetails')`), W (upsert) — **text**, not uuid
- `updated_at` — W (snake) on every upsert
- Global-settings columns — **W camelCase** (`updatePlatformSettings` spreads camelCase `PlatformSettings` keys), R (snake first, camel fallback → either casing reads fine):
  `announcementEnabled`, `announcementMessage`, `platformName`, `defaultCurrency`,
  `statementFooterText`, `deskTimezone`, `logoUrl`, `brandPrimaryColor`, `brandAccentColor`,
  `defaultLanguage`, `supportedLanguages` (text[]), `notifyOnNewApplicant`, `notifyOnFundingRequest`,
  `notifyOnLargeTrade`, `largeTradeThreshold` (numeric), `sessionTimeoutMinutes` (int),
  `minPasswordLength` (int), `welcomeEmailSubjectOverride`, `welcomeEmailIntroOverride`,
  `invoicePrefix`, `invoiceIncludeYear` (bool), `invoicePadLength` (int)
- Funding-details columns — **W camelCase** (`updateFundingDetails` spreads camelCase `FundingDetails` keys), R (both accepted):
  `bankEnabled`, `bankName`, `bankAddress`, `bankSwift`, `bankAccountName`, `bankAccountNumber`,
  `beneficiaryAddress`, `bankRoutingOrIban`, `paymentReason`, `cryptoEnabled`, `cryptoWallets` (jsonb array),
  `extraInstructions`, `emailSubject`, `emailIntro`, `supportEmail`, `supportPhone`, `companyAddress`

**Note:** writes are camelCase here (unlike almost everywhere else); reads accept both, so camelCase physical columns are the safe choice for this table.

## 14. `supportTickets`

Usage: `services/investor/ticketService.ts`. Snake_case — clean.

- `id` — F
- `user_id` — R/F/W (`eq('user_id', …)`)
- `user_email` — R/W
- `subject` / `message` — R/W
- `status` — R/W (`open|answered|closed`)
- `admin_reply` — R/W
- `created_at` — R/W/F (`order('created_at')`)
- `updated_at` — W

## 15. `auditLogs`

Usage: `services/investor/auditService.ts`.

- `id` — R (never written → uuid default)
- `actor_id` — W (snake) — ⚠️ read as `data.actorId` (camel)
- `actor_email` — W (snake) — ⚠️ read as `data.actorEmail` (camel)
- `action` — R/W (same)
- `details` — R/W (nullable text)
- `created_at` — W (snake) + F (`order('created_at')`) — ⚠️ read as `data.createdAt` (camel)

**Inconsistency:** writes snake / reads camel for `actorId`, `actorEmail`, `createdAt` → admin audit list renders empty actor/date unless mirror columns exist.

## 16. `kycSubmissions`

Usage: `services/investor/kycService.ts`.

- `id` — R (never written → uuid default)
- `userId` — **W camel** (insert spreads `Omit<KycSubmission,…>` → `userId`, `userEmail`, `fullName`, `dateOfBirth`, `address`, `phone`, `idType`, `idNumber`) — ⚠️ **filtered as `user_id`** (`eq('user_id', …)`) and mapper prefers `data.user_id`
- `userEmail` — W camel — ⚠️ read prefers `user_email`
- `fullName` — W camel — ⚠️ read prefers `full_name`
- `dateOfBirth` — W camel — ⚠️ read prefers `date_of_birth`
- `address` — R/W (same spelling, text)
- `phone` — R/W (same)
- `idType` — W camel — ⚠️ read prefers `id_type`
- `idNumber` — W camel — ⚠️ read prefers `id_number`
- `id_document_url` — W (snake, optional) — read both accepted
- `status` — R/F/W (`pending|verified|rejected`)
- `review_note` — W (snake, `reviewKyc`) — read both accepted
- `created_at` — W (snake) + F (`order('created_at')`)
- `updated_at` — W (snake)

**Inconsistency (critical):** `submitKyc` inserts camelCase keys (`userId`, `fullName`, `idType`, …). Without camelCase columns the insert fails with `PGRST204` (column not found); with only camelCase columns the `eq('user_id', …)` filter matches nothing. Needs both spellings (or a code fix).

## 17. `kycDocuments`

Usage: `services/investor/kycService.ts`. Snake_case — clean.

- `id` — F (`eq('id', …)`)
- `user_id` — R/F/W (`eq('user_id', …)`)
- `user_email` — R/W
- `client_name` — R/W
- `doc_type` — R/W
- `file_name` — R/W
- `storage_path` — R/W
- `file_url` — R/W
- `file_removed` — R/W (boolean, default false)
- `status` — R/F/W (`pending|approved|rejected`)
- `review_note` — R/W
- `submitted_at` — R/W/F (`order('submitted_at')`)
- `reviewed_at` — W
- `updated_at` — W

## 18. `strategies`

Usage: `services/investor/strategyService.ts`. Snake_case — clean.

- `id` — F (delete eq id; uuid default)
- `name` — R/W
- `description` — R/W
- `risk_level` — R/W (`low|medium|high`, default `medium`)
- `target_allocation` — R/W (text)
- `created_at` — R/W/F (`order('created_at')`)

## 19. `aiSignals`

Usage: `services/investor/aiSignalService.ts` (read-only; generation paused).

- `id` — R
- `user_id` — F (`eq('user_id', …)`)
- `symbol` — R
- `side` — R (`buy|sell|hold`)
- `confidence` — R (numeric)
- `rationale` — R
- `indicatorSummary` — R (**camel only**)
- `indicators` — R (jsonb `{sma20, sma50, rsi14, macd, lastClose}`)
- `created_at` — R/F (`order('created_at')`)

## 20. `aiUsage`

Usage: `services/investor/subscriptionService.ts` (browser **reads only**; writes come from the backend signal function).

- `id` — F (`eq('id', …)`) — **text** `${userId}_${YYYY-MM}` (`usageDocId`)
- `userId` — R (camel fallback `data.userId`; mapper prefers `user_id`)
- `user_id` — implied snake physical (mapper prefers it)
- `period` — R (`'2026-08'`)
- `signals_used` — R (mapper prefers; camel fallback `signalsUsed`) — int
- `updated_at` — R (snake)

## 21. `planRequests`

Usage: `services/investor/subscriptionService.ts`. Snake_case — clean.

- `id` — F, R (insert `.select('id').single()`)
- `user_id` — R/F (`eq('user_id', …)`)
- `user_email` — R/W
- `current_plan` — R/W
- `requested_plan` — R/W
- `status` — R/F (`eq('status','pending')`)/W (`pending|approved|declined`)
- `note` — R/W
- `created_at` — R/W
- `resolved_at` — W

## 22. `referralCodes`

Usage: `services/investor/referralService.ts`. Snake_case — clean.

- `id` — (never written → uuid default)
- `code` — F (`eq('code', …)`, lowercased) — should be UNIQUE
- `user_id` — R/W (uuid)
- `created_at` — W

## 23. `referrals`

Usage: `services/investor/referralService.ts`. Snake_case — clean.

- `id` — R
- `referrer_user_id` — R/F/W (`eq('referrer_user_id', uid)`)
- `referred_user_id` — W (uuid)
- `referred_email` — R/W
- `code` — R/W
- `status` — R/W (`signed_up|funded|rejected`)
- `created_at` — R/W/F (`order('created_at')`)

## 24. `assetGroups`

Usage: `services/investor/assetCatalogService.ts`.

- `id` — R
- `label` — R (camel only)
- `assetClass` — R (camel only) — ⚠️ **filtered as `asset_class`** (snake)
- `parentLabel` — R (camel only)
- `sortOrder` — R (camel only) — ⚠️ **ordered as `sort_order`** (snake)
- `description` — R (camel)

**Inconsistency:** pure camel reads vs snake filters/order — needs mirror columns or a code fix. No browser writes (rows seeded elsewhere).

## 25. `assets`

Usage: `services/investor/assetCatalogService.ts`, `orderService` (symbol lookup).

- `id` — F (`eq('id', asset.id)`), W (upsert) — ⚠️ **TEXT: the uppercase SYMBOL** (`InvestorAdminAssetsPage` sets `id = symbol.toUpperCase()`); also realtime filter `id=eq.{symbol}`
- `symbol` — R/F (`eq('symbol', upper)`)/W (same spelling)
- `name` — R/W (same)
- `assetClass` — R (camel) — ⚠️ **filtered as `asset_class`**
- `groupId` — R (camel) — ⚠️ **filtered as `group_id`**; W camel (upsert spread)
- `exchange` — R/W (same)
- `sector` — R/W (same)
- `contractUnit` — R (camel)
- `priority` — R/W (camel, default `'core'`)
- `quoteSymbol` — R (camel, nullable)
- `underlyingPriceSymbol` — R (camel, nullable)
- `dataProvider` — R/W (camel, default `'finnhub'`)
- `quote` — R (camel, jsonb `{price, change, changePercent, fetchedAt}`)
- `isTradable` — R (camel) — ⚠️ **written as `is_tradable`** (snake, `setAssetTradable`)
- `isActive` — R (camel) — ⚠️ **written as `is_active`** (snake) and **filtered as `is_active`**
- `sortOrder` — R (camel)
- `createdAt` — R (camel) — ⚠️ **written as `created_at`** (snake, on create)
- `updatedAt` — R (camel) — ⚠️ **written as `updated_at`** (snake)

**Inconsistencies (critical):** reads camel-only vs snake writes/filters on `asset_class`, `group_id`, `is_active`, `is_tradable`, `created_at`, `updated_at`; the upsert spreads camelCase keys + snake timestamps in the same payload.

**Realtime:** channel `asset-{symbol}`, table `assets`, `filter: id=eq.{symbol}`.

## 26. `cashLedger` — ⛔ ZERO USAGE

No browser usage (comments only). Written exclusively by SQL functions (`confirm_funding_receipt`,
`record_client_deposit`, `backfill_deposit_ledger`). **Candidate to skip** in client DDL; it must
exist for the RPCs, shaped by the function definitions (suggested: `id uuid pk`, `user_id uuid`,
`type text`, `amount numeric`, `reference text`, `note text`, `created_by text`, `created_at timestamptz`).

## 27. `subPortfolios`

Usage: `services/investor/subPortfolioService.ts`.

- `id` — F (update/delete eq id)
- `user_id` — R/F (`eq('user_id', …)`)/W (snake)
- `name` — R/W (same)
- `asset_class` — R/W (snake; read camel fallback)
- `base_currency` — R/W (snake)
- `target_allocation_pct` — R/W (snake, numeric) — ⚠️ `updateSubPortfolio` patch writes camel `targetAllocationPct`
- `risk_band` — R/W (snake) — ⚠️ patch writes camel `riskBand`
- `status` — R/W (`active|paused|closed`)
- `created_at` — W (snake)
- `updated_at` — W (snake)

**Inconsistency:** `update({ ...patch })` sends camelCase `targetAllocationPct` / `riskBand` → `PGRST204` unless camel columns also exist.

## 28. `subPortfolioHoldings`

Usage: `services/investor/subPortfolioService.ts`.

- `id` — F/W (upsert) — **text** `${subPortfolioId}_${SYMBOL}`
- `sub_portfolio_id` — R/F (`eq('sub_portfolio_id', …)`)/W (snake)
- `user_id` — R/W (snake)
- `symbol` — R/W (same)
- `display_name` — R/W (snake)
- `quantity` — R/W (same, numeric)
- `avg_cost` — R/W (snake) — ⚠️ `updateSleeveHolding` patch writes camel `avgCost`
- `mark_price` — R/W (snake) — ⚠️ patch writes camel `markPrice`
- `unit_label` — R/W (snake, default `'shares'`)
- `currency` — R/W (default `'USD'`)
- `updated_at` — W (snake)

**Inconsistency:** camelCase patch keys (`avgCost`, `markPrice`) on update.

## 29. `portfolioSnapshots`

Usage: `services/investor/portfolioHistoryService.ts` (read-only; written by RPC `snapshotPortfolios` / `run_portfolio_snapshot_now`).

- `id` — R (implied; uuid default)
- `user_id` — F (`eq('user_id', …)`)
- `date` — R/F (`order('date')`) — `YYYY-MM-DD` → `date`
- `portfolio_value` — R (snake, numeric; camel fallback)
- `cash_balance` — R (snake)
- `total_value` — R (snake)
- `day_change` — R (snake)
- `day_change_percent` — R (snake)

## 30. `crmLeads`

Usage: `services/investor/crm/crmLeadService.ts`, `crmGiInboxService.ts`.

- `id` — F (`eq('id', …)`, `.in('id', chunk)`)
- `first_name` — R/W (snake)
- `last_name` — R/W (snake)
- `company` — R/W (same)
- `phone_e164` — R/F (`select`+`.in('phone_e164', …)`)/W (snake)
- `email` — R/F (`.in('email', …)`)/W (same)
- `country` — R/W (same)
- `tags` — R/W (text[])
- `status` — R/W (`new|working|customer|dead`)
- `source` — R/W (jsonb `{kind, batchId?, file?, mission?}` — nested keys camelCase)
- `consent_basis` — R/W (snake)
- `consent_note` — R/W (snake) — ⚠️ **`updateLead` patch writes camel `consentNote`**
- `gi_lead_id` — R/W (snake)
- `payload` — W (jsonb, GI dossier; written but never read in `src/`)
- `notes` — R/W (same)
- `created_at` — R/W/F (`order('created_at')`)
- `updated_at` — R/W
- `last_exported_at` — R/W (`.update` with `.in('id', chunk)`)

**Inconsistency:** `updateLead({ consentNote })` camel vs snake column elsewhere.

## 31. `crmImports`

Usage: `services/investor/crm/crmImportService.ts`.

- `id` — R (insert `.select('id').single()`; uuid default)
- `files` — R/W (camel, jsonb array `{name, size, storagePath?}`)
- `mapping` — R/W (camel, jsonb)
- `consentBasis` — W camel — R prefers `consent_basis` (fallback camel)
- `counts` — R/W (camel, jsonb)
- `confirmedBy` — W camel — R prefers `confirmed_by`
- `confirmedByEmail` — W camel — R prefers `confirmed_by_email`
- `created_at` — W (snake) + F (`order('created_at')`)

**Inconsistency:** insert is camelCase, read prefers snake_case → reads fall back OK, but keep camel physical columns.

## 32. `crmSuppression`

Usage: `services/investor/crm/crmSuppressionService.ts`. Snake_case — clean.

- `id` — F (delete eq id)
- `type` — R/W (`'email' | 'phone'`; ⚠️ reserved-ish word, quote in SQL)
- `value` — R/F (`select('value').in('value', chunk)`)/W (quote in SQL)
- `reason` — R/W (`unsubscribe|bounce|complaint|manual`)
- `source` — R/W (optional)
- `added_at` — R/F (`order('added_at')`)/W

## 33. `crmInstruments`

Usage: `services/investor/crm/crmInstrumentService.ts`.

- `id` — R/W (upsert seeds) — ⚠️ **TEXT slug** (`'gold-options'`, `'gold'`, `'preipo'`); `upsertInstrument` omits `id` (relies on default) → give `id text DEFAULT gen_random_uuid()::text` + `slug UNIQUE`
- `slug` — R/F (`eq('slug', …)`)/W (same) — **natural key**
- `name` — R/W (same)
- `asset_class` — W snake (upsertInstrument) — read camel fallback — ⚠️ **seed spreads camel `assetClass`**
- `status` — R/W (`active|…`)
- `landing` — R/W (jsonb, camelCase nested keys)
- `risk_disclosure` — W snake — read camel fallback — ⚠️ seed/update patch write camel `riskDisclosure`
- `default_appointment_url` — W snake — read camel fallback — ⚠️ seed/update patch write camel `defaultAppointmentUrl`
- `default_demo_url` — W snake — read camel fallback — ⚠️ seed/update patch write camel `defaultDemoUrl`
- `default_steps` — W snake — read camel fallback — ⚠️ seed/update patch write camel `defaultSteps`
- `created_at` — R/W (snake)
- `updated_at` — R/W (snake)

**Inconsistency:** `ensureBuiltinInstruments` seeds and `updateInstrument` patches are camelCase; `upsertInstrument` is snake_case. Both paths hit the same table.

## 34. `crmCampaigns`

Usage: `services/investor/crm/crmCampaignService.ts`.

- `id` — F, R (insert `.select('id').single()`)
- `name` — R/W (same)
- `track` — R/W (legacy alias of `instrument_slug`)
- `instrument_slug` — R/W (snake; mapper prefers, falls back to `track`)
- `status` — R/W (`draft|…`)
- `steps` — R/W (jsonb)
- `settings` — R/W (jsonb, camelCase nested keys)
- `stats` — R/W (jsonb)
- `created_by` — R/W (snake)
- `created_at` — R/W/F (`order('created_at')`)
- `updated_at` — R/W

## 35. `crmEnrollments` *(in config; not in the requested list — covered anyway)*

Usage: `services/investor/crm/crmCampaignService.ts`.

- `id` — F (`.eq('id', …)`, existence check) / W — **text** `${campaignId}_${leadId}` (idempotency key)
- `campaign_id` — R/F (`eq('campaign_id', …)`)/W (uuid)
- `lead_id` — R/W (uuid)
- `email` — R/W
- `first_name` — W (snake)
- `step` — R/W (int, default 0)
- `next_send_at` — R/W (timestamptz)
- `status` — R/W (`active|completed|unsubscribed|…`)
- `last_error` — R (snake, camel fallback)
- `enrolled_at` — R/W (snake)
- `last_sent_at` — R/W (snake)
- `funnel_stage` — R/W (snake)

## 36. `crmEmailEvents` — ⛔ ZERO USAGE in `src/`

No reference in the browser code. Presumably written by the `functions-crm` scheduled worker
(campaign sends/bounces). **Candidate to skip** in the client-facing DDL.

## 37. `crmInbound`

Usage: `services/investor/crm/crmGiInboxService.ts` (browser reads + status updates; the insert is done by the GI webhook outside `src/`).

- `id` — F (update eq id)
- `gi_lead_id` — R (snake)
- `mission` — R
- `segment` — R
- `lead` — R (jsonb; nested keys read both casings: `first_name ?? firstName`, …)
- `dossier` — R (jsonb)
- `status` — R/F (`eq('status', status)`)/W (`pending|accepted|declined`)
- `received_at` — R/F (`order('received_at')`)
- `reviewed_by_email` — W (snake)
- `reviewed_at` — W (snake)
- `decline_reason` — W (snake)

## 38. `crmSources` — ⛔ ZERO USAGE

No reference in `src/`. Lead provenance is stored as the embedded `crmLeads.source` jsonb instead.
**Candidate to skip.**

---

# Naming-inconsistency summary (top findings)

1. **`profiles`** — same logical columns in both conventions: `createdAt` (W camel) vs `created_at` (F snake); `accountStatus` (W camel) vs `account_status` (F snake); `updatedAt` AND `updated_at` both written; `planSince` (R camel) vs `plan_since` (W snake). Reads are camel-only.
2. **`adminOrders`** — insert/filter snake (`order_type`, `filled_quantity`, `client_status`, `user_id`, `created_at`) vs camel-only reads (`mapOrder`); `correctPositionTerms` writes snake `strike_price`/`entry_underlying_price` that are read back as camel.
3. **`trades`** — camel-only reads (`tradeRef`, `orderId`, `executedAt`, …) vs snake filters (`user_id`, `order_id`, `executed_at`) and snake writes (`strike_price`, `entry_underlying_price`).
4. **`portfolioHoldings`** — browser writes snake `manual_pnl`/`manual_pnl_as_of`/`strike_price`/`entry_underlying_price`, reads camel `manualPnl`/`manualPnlAsOf`/`strikePrice`/`entryUnderlyingPrice`; `userId` read camel vs `user_id` filter.
5. **`assets` / `assetGroups`** — camel-only reads (`assetClass`, `groupId`, `isActive`, `isTradable`, `sortOrder`, `createdAt`) vs snake filters/writes (`asset_class`, `group_id`, `is_active`, `is_tradable`, `created_at`, `updated_at`); `assets.id` is a **text symbol**, not uuid.
6. **`kycSubmissions`** — browser insert camelCase (`userId`, `fullName`, `idType`, …) vs snake filter `user_id`; insert would fail outright with only snake columns.
7. **`wallets`** — read camel `userId` vs stored/filtered `user_id`.
8. **`auditLogs`** — write snake (`actor_id`, `actor_email`, `created_at`), read camel (`actorId`, `actorEmail`, `createdAt`).
9. **`crmLeads`** — `updateLead` writes camel `consentNote` (column is otherwise snake `consent_note`).
10. **`crmInstruments`** — camel seeds/patches (`assetClass`, `riskDisclosure`, `defaultAppointmentUrl`, `defaultDemoUrl`, `defaultSteps`) vs snake upsert.
11. **`subPortfolios` / `subPortfolioHoldings`** — camel patch keys (`targetAllocationPct`, `riskBand`, `avgCost`, `markPrice`) vs snake columns.
12. **`crmImports`** — camel insert (`consentBasis`, `confirmedBy`, `confirmedByEmail`) vs snake-preferring reads.
13. `clientNotifications` / `staffNotifications` use a column literally named **`read`** — a reserved word, must be quoted.

**Recommendation:** either (a) normalize the service mappers/writers to one convention, or (b) keep dual
columns synced. The DDL below uses (b) where conflicts exist: physical column in the casing used by
filters/writes, plus a mirror column for the other casing — `GENERATED ALWAYS AS` for text/number/bool/uuid
mirrors (immutable casts), and a `BEFORE` trigger for timestamptz mirrors (tz-dependent casts are not immutable).

---

# Draft PostgreSQL DDL

> Draft only — review before applying. `id uuid DEFAULT gen_random_uuid()` except where code clearly
> uses text ids (assets = symbol, platformSettings = 'global'/'fundingDetails', aiUsage =
> `${userId}_${period}`, subPortfolioHoldings/crmEnrollments = composite text, crmInstruments = slug,
> watchlists/profiles = auth uid). `user_id` columns are `uuid` (always compared to the Supabase auth uid).

```sql
create extension if not exists pgcrypto;

-- ============================================================= profiles
-- Conflict columns: camelCase physical (writes/reads) + snake mirrors
-- (created_at, account_status) + updated_at dual + plan_since/planSince.
create table if not exists "profiles" (
  id                      uuid primary key,                    -- auth uid, inserted by code
  "email"                 text not null,
  "username"              text,
  "firstName"             text,
  "lastName"              text,
  "displayName"           text,
  "phone"                 text,
  "role"                  text not null default 'client',
  "accountStatus"         text not null default 'pending',
  account_status          text generated always as ("accountStatus") stored,  -- filter mirror
  "investorTier"          text default 'standard',
  "createdAt"             timestamptz,
  created_at              timestamptz,                         -- order mirror (trigger sync, see below)
  "updatedAt"             timestamptz,
  updated_at              timestamptz,                         -- code writes BOTH spellings
  "plan"                  text,
  plan_since              timestamptz,                         -- written snake by setPlanForUser
  "planSince"             timestamptz,                         -- read camel (trigger sync)
  "onboardingCompleted"   boolean default false,
  "onboardingCompletedAt" timestamptz,
  "onboardingSkipped"     boolean default false,
  "onboardingSource"      text,
  "createdBy"             text,
  "middleName"            text,
  "dateOfBirth"           text,
  "gender"                text,
  "address"               jsonb,        -- {line1,line2,city,state,postalCode,country}
  "citizenship"           text,
  "residencyCountry"      text,
  "idType"                text,
  "employment"            jsonb,        -- {status,employer,jobTitle,annualIncome,incomeSource}
  "investmentProfile"     jsonb,        -- {objective,riskTolerance,experienceLevel,...}
  "compliance"            jsonb,        -- {fatcaStatus,crsReporting,pep,...}
  "accountManager"        jsonb         -- {name,email,phone}
);
create index if not exists profiles_account_status_idx on "profiles" (account_status);
create index if not exists profiles_created_at_idx     on "profiles" (created_at desc);

-- ============================================================= wallets
create table if not exists "wallets" (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,                                 -- filter/write casing
  "userId"    uuid generated always as (user_id) stored,     -- camel read mirror
  balance     numeric not null default 0,
  currency    text not null default 'USD',
  label       text,
  status      text default 'active',
  created_at  timestamptz default now(),
  updated_at  timestamptz
);
create unique index if not exists wallets_user_id_uidx on "wallets" (user_id);

-- ============================================================= watchlists
create table if not exists "watchlists" (
  id          uuid primary key,                              -- = auth uid
  user_id     uuid not null,
  symbols     text[] not null default '{}',
  updated_at  timestamptz
);

-- ============================================================= portfolioHoldings
-- Writes/filters snake; reads camel → snake physical + camel mirrors.
create table if not exists "portfolioHoldings" (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null,
  "userId"                  uuid generated always as (user_id) stored,
  symbol                    text not null,
  "name"                    text,
  "shares"                  numeric default 0,   -- legacy RPC may write "quantity"; both read
  "quantity"                numeric,
  "avgCost"                 numeric default 0,   -- legacy aliases: "averagePrice", "avgPrice"
  "averagePrice"            numeric,
  "currentPrice"            numeric default 0,   -- legacy alias "price"
  "sector"                  text,
  "assetId"                 text,                -- assets.id is a symbol string
  strike_price              numeric,             -- written snake by correctPositionTerms
  "strikePrice"             numeric generated always as (strike_price) stored,
  entry_underlying_price    numeric,             -- written snake
  "entryUnderlyingPrice"    numeric generated always as (entry_underlying_price) stored,
  "multiplier"              numeric,
  "contractSize"            numeric,
  "optionType"              text check ("optionType" in ('call','put')),
  manual_pnl                numeric,             -- written snake by setHoldingManualPnl
  "manualPnl"               numeric generated always as (manual_pnl) stored,
  manual_pnl_as_of          text,                -- 'YYYY-MM-DD'
  "manualPnlAsOf"           text generated always as (manual_pnl_as_of) stored,
  updated_at                timestamptz
);
create index if not exists holdings_user_id_idx on "portfolioHoldings" (user_id);

-- ============================================================= fundingRequests
create table if not exists "fundingRequests" (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null,
  user_email         text,
  amount             numeric not null,
  status             text not null default 'pending'
                     check (status in ('pending','approved','funded','rejected')),
  reference          text,                                     -- SG-FUND{YY}{NNNNN}
  awaiting_payment   boolean default false,
  payment_claimed_at timestamptz,
  payment_proofs     jsonb not null default '[]',              -- [{name,url,path,size,content_type,uploaded_at}]
  approved_at        timestamptz,
  funded_at          timestamptz,
  email_sent_at      timestamptz,
  email_error        text,
  source             text not null default 'client' check (source in ('client','admin')),
  note               text,
  recorded_by_email  text,
  recorded_by_uid    uuid,
  created_at         timestamptz default now(),
  updated_at         timestamptz
);
create index if not exists funding_user_status_idx on "fundingRequests" (user_id, status);
create index if not exists funding_created_idx     on "fundingRequests" (created_at desc);

-- ============================================================= invoices
create table if not exists "invoices" (
  id                          uuid primary key default gen_random_uuid(),
  number                      text not null,
  user_id                     uuid not null,
  bill_to_name                text not null,
  bill_to_email               text not null,
  bill_to_company             text,
  bill_to_address             text,
  currency                    text not null default 'USD',
  line_items                  jsonb not null default '[]',   -- [{description,quantity,unitPrice}]
  tax_rate                    numeric not null default 0,
  tax_label                   text not null default 'Tax',
  notes                       text,
  payment_terms               text,
  due_date                    timestamptz,
  include_payment_instructions boolean not null default false,
  send_mode                   text not null default 'auto' check (send_mode in ('auto','manual')),
  status                      text not null default 'issued' check (status in ('issued','sent','paid','void')),
  issued_at                   timestamptz,
  payment_claimed_at          timestamptz,
  payment_proofs              jsonb,
  paid_at                     timestamptz,
  email_sent_at               timestamptz,
  email_error                 text,
  created_by_uid              uuid,
  created_by_email            text,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz
);
create index if not exists invoices_user_idx      on "invoices" (user_id);
create index if not exists invoices_created_idx   on "invoices" (created_at desc);

-- ============================================================= clientNotifications
create table if not exists "clientNotifications" (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  type        text not null default 'invoice',
  title       text not null,
  body        text not null default '',
  href        text not null default '/workspace/invoices',
  "read"      boolean not null default false,                -- reserved word: quoted
  created_at  timestamptz default now(),
  updated_at  timestamptz
);
create index if not exists client_notices_user_idx on "clientNotifications" (user_id, created_at desc);

-- ============================================================= staffNotifications
create table if not exists "staffNotifications" (
  id          uuid primary key default gen_random_uuid(),
  type        text,                                          -- 'invoice-payment'
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

-- ============================================================= adminOrders  (code key: orders)
-- Insert/filter snake; reads camel → snake physical + camel mirrors.
create table if not exists "adminOrders" (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null,
  "userId"                  uuid generated always as (user_id) stored,
  user_email                text,
  "userEmail"               text generated always as (user_email) stored,
  asset_id                  text,                              -- assets.id = symbol
  "assetId"                 text generated always as (asset_id) stored,
  symbol                    text not null,
  side                      text not null check (side in ('buy','sell')),
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
                            check (status in ('pending','working','partially_filled','filled','cancelled','rejected','expired')),
  filled_quantity           numeric not null default 0,
  "filledQuantity"          numeric generated always as (filled_quantity) stored,
  avg_fill_price            numeric,
  "avgFillPrice"            numeric generated always as (avg_fill_price) stored,
  client_status             text default 'pending',
  "clientStatus"            text generated always as (client_status) stored,
  rejection_reason          text,
  "rejectionReason"         text generated always as (rejection_reason) stored,
  option_type               text check (option_type in ('call','put')),
  "optionType"              text generated always as (option_type) stored,
  strike_price              numeric,                           -- written snake by correctPositionTerms
  "strikePrice"             numeric generated always as (strike_price) stored,
  expiry_date               text,
  "expiryDate"              text generated always as (expiry_date) stored,
  contract_size             numeric,
  "contractSize"            numeric generated always as (contract_size) stored,
  entry_underlying_price    numeric,
  "entryUnderlyingPrice"    numeric generated always as (entry_underlying_price) stored,
  delivery_type             text check (delivery_type in ('cash_settled','physical')),
  "deliveryType"            text generated always as (delivery_type) stored,
  fees                      numeric default 0,
  commission                numeric default 0,
  sub_portfolio_id          uuid,
  "subPortfolioId"          uuid generated always as (sub_portfolio_id) stored,
  created_at                timestamptz default now(),         -- filter: order('created_at')
  "createdAt"               timestamptz,                       -- camel read mirror (trigger)
  filled_at                 timestamptz,
  "filledAt"                timestamptz,                       -- trigger
  cancelled_at              timestamptz,
  "cancelledAt"             timestamptz,                       -- trigger
  updated_at                timestamptz
);
create index if not exists orders_user_created_idx on "adminOrders" (user_id, created_at desc);

-- ============================================================= priceAlerts
create table if not exists "priceAlerts" (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  asset_id        text not null,
  symbol          text not null,
  condition       text not null default 'above' check (condition in ('above','below')), -- unquoted ok
  target_price    numeric not null,
  status          text not null default 'active' check (status in ('active','triggered','cancelled')),
  seen            boolean not null default true,
  triggered_at    timestamptz,
  triggered_price numeric,
  created_at      timestamptz default now(),
  updated_at      timestamptz
);
create index if not exists alerts_user_idx on "priceAlerts" (user_id, created_at desc);

-- ============================================================= trades
-- Filters snake (user_id, order_id, executed_at); reads camel → mirrors.
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
  side                      text not null check (side in ('buy','sell')),
  quantity                  numeric not null default 0,
  price                     numeric not null default 0,
  gross_amount              numeric not null default 0,
  "grossAmount"             numeric generated always as (gross_amount) stored,
  fees                      numeric not null default 0,
  commission                numeric not null default 0,
  currency                  text not null default 'USD',
  executed_at               timestamptz,                       -- order('executed_at')
  "executedAt"              timestamptz,                       -- trigger mirror
  remarks                   text not null default 'OPEN'
                            check (remarks in ('OPEN','PARTIALLY_FILLED','CLOSED','ADJUSTED')),
  client_status             text,
  "clientStatus"            text generated always as (client_status) stored,
  option_type               text,
  "optionType"              text generated always as (option_type) stored,
  strike_price              numeric,                           -- written snake
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
create index if not exists trades_user_exec_idx  on "trades" (user_id, executed_at desc);
create index if not exists trades_order_idx      on "trades" (order_id);

-- ============================================================= platformSettings  (code key: settings)
create table if not exists "platformSettings" (
  id                            text primary key,              -- 'global' | 'fundingDetails'
  -- global settings (written camelCase)
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
  -- funding details row (written camelCase)
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
  "cryptoWallets"               jsonb not null default '[]',   -- [{asset,network,address,memo}]
  "extraInstructions"           text default '',
  "emailSubject"                text default '',
  "emailIntro"                  text default '',
  "supportEmail"                text default '',
  "supportPhone"                text default '',
  "companyAddress"              text default '',
  updated_at                    timestamptz
);

-- ============================================================= supportTickets
create table if not exists "supportTickets" (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  user_email   text,
  subject      text not null,
  message      text not null,
  status       text not null default 'open' check (status in ('open','answered','closed')),
  admin_reply  text,
  created_at   timestamptz default now(),
  updated_at   timestamptz
);
create index if not exists tickets_user_idx on "supportTickets" (user_id, created_at desc);

-- ============================================================= auditLogs
create table if not exists "auditLogs" (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid,                                          -- written snake
  "actorId"    uuid generated always as (actor_id) stored,    -- read camel
  actor_email  text,
  "actorEmail" text generated always as (actor_email) stored,
  action       text not null,
  details      text,
  created_at   timestamptz default now(),                     -- filter
  "createdAt"  timestamptz                                    -- read camel (trigger)
);
create index if not exists audit_created_idx on "auditLogs" (created_at desc);

-- ============================================================= kycSubmissions
-- Browser insert is camelCase; filter/read prefer snake → dual columns.
create table if not exists "kycSubmissions" (
  id                uuid primary key default gen_random_uuid(),
  "userId"          uuid not null,
  user_id           uuid generated always as ("userId") stored,   -- filter mirror
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
  status            text not null default 'pending' check (status in ('pending','verified','rejected')),
  review_note       text,
  created_at        timestamptz default now(),
  updated_at        timestamptz
);
create index if not exists kyc_sub_user_idx on "kycSubmissions" (user_id, created_at desc);

-- ============================================================= kycDocuments
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
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note   text,
  submitted_at  timestamptz default now(),
  reviewed_at   timestamptz,
  updated_at    timestamptz
);
create index if not exists kyc_doc_user_idx on "kycDocuments" (user_id, submitted_at desc);

-- ============================================================= strategies
create table if not exists "strategies" (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  description       text not null default '',
  risk_level        text not null default 'medium' check (risk_level in ('low','medium','high')),
  target_allocation text not null default '',
  created_at        timestamptz default now()
);

-- ============================================================= aiSignals
create table if not exists "aiSignals" (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null,
  symbol             text not null,
  side               text not null check (side in ('buy','sell','hold')),
  confidence         numeric not null default 0,
  rationale          text not null default '',
  "indicatorSummary" text not null default '',
  indicators         jsonb,                                   -- {sma20,sma50,rsi14,macd,lastClose}
  created_at         timestamptz default now()
);
create index if not exists ai_signals_user_idx on "aiSignals" (user_id, created_at desc);

-- ============================================================= aiUsage
create table if not exists "aiUsage" (
  id            text primary key,                             -- `${userId}_${YYYY-MM}`
  user_id       uuid not null,
  period        text not null,                                -- '2026-08'
  signals_used  integer not null default 0,
  updated_at    timestamptz
);

-- ============================================================= planRequests
create table if not exists "planRequests" (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  user_email      text not null default '',
  current_plan    text not null,
  requested_plan  text not null,
  status          text not null default 'pending' check (status in ('pending','approved','declined')),
  note            text not null default '',
  created_at      timestamptz default now(),
  resolved_at     timestamptz
);
create index if not exists plan_req_status_idx on "planRequests" (status);

-- ============================================================= referralCodes
create table if not exists "referralCodes" (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  user_id     uuid not null,
  created_at  timestamptz default now()
);

-- ============================================================= referrals
create table if not exists "referrals" (
  id               uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null,
  referred_user_id uuid not null,
  referred_email   text not null default '',
  code             text not null,
  status           text not null default 'signed_up' check (status in ('signed_up','funded','rejected')),
  created_at       timestamptz default now()
);
create index if not exists referrals_referrer_idx on "referrals" (referrer_user_id, created_at desc);

-- ============================================================= assetGroups
-- Reads camel-only; filters asset_class/sort_order snake → camel physical + snake mirrors.
create table if not exists "assetGroups" (
  id            uuid primary key default gen_random_uuid(),
  "label"       text not null,
  "assetClass"  text not null,
  asset_class   text generated always as ("assetClass") stored,   -- filter mirror
  "parentLabel" text not null default '',
  "sortOrder"   integer not null default 0,
  sort_order    integer generated always as ("sortOrder") stored, -- order mirror
  "description" text
);
create index if not exists asset_groups_class_idx on "assetGroups" (asset_class, sort_order);

-- ============================================================= assets
-- id = uppercase SYMBOL (text). Reads camel; filters/writes snake for several columns.
create table if not exists "assets" (
  id                       text primary key,                     -- uppercase symbol
  symbol                   text not null,
  "name"                   text not null,
  "assetClass"             text not null,
  asset_class              text generated always as ("assetClass") stored,
  "groupId"                uuid,                                 -- FK→assetGroups.id
  group_id                 uuid generated always as ("groupId") stored,
  "exchange"               text,
  "sector"                 text,
  "contractUnit"           text,
  "priority"               text not null default 'core',
  "quoteSymbol"            text,
  "underlyingPriceSymbol"  text,
  "dataProvider"           text not null default 'finnhub',
  "quote"                  jsonb,                                -- {price,change,changePercent,fetchedAt}
  is_tradable              boolean not null default true,        -- written snake
  "isTradable"             boolean generated always as (is_tradable) stored,
  is_active                boolean not null default true,        -- written + filtered snake
  "isActive"               boolean generated always as (is_active) stored,
  "sortOrder"              integer,
  created_at               timestamptz,                          -- written snake
  "createdAt"              timestamptz,                          -- read camel (trigger)
  updated_at               timestamptz,
  "updatedAt"              timestamptz                           -- read camel (trigger)
);
create index if not exists assets_class_idx   on "assets" (asset_class) where is_active;
create index if not exists assets_group_idx   on "assets" (group_id) where is_active;
create index if not exists assets_symbol_idx  on "assets" (symbol);

-- ============================================================= subPortfolios
create table if not exists "subPortfolios" (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null,
  name                  text not null,
  asset_class           text not null default 'equities'
                        check (asset_class in ('equities','crypto','commodities','managed_strategy')),
  base_currency         text not null default 'USD',
  target_allocation_pct numeric,                                -- ⚠️ camel patch writes "targetAllocationPct"
  risk_band             text check (risk_band in ('conservative','moderate','aggressive')),
  status                text not null default 'active' check (status in ('active','paused','closed')),
  created_at            timestamptz default now(),
  updated_at            timestamptz
);
create index if not exists sub_portfolios_user_idx on "subPortfolios" (user_id);

-- ============================================================= subPortfolioHoldings
create table if not exists "subPortfolioHoldings" (
  id               text primary key,                             -- `${subPortfolioId}_${SYMBOL}`
  sub_portfolio_id uuid not null references "subPortfolios" (id) on delete cascade,
  user_id          uuid not null,
  symbol           text not null,
  display_name     text,
  quantity         numeric not null default 0,
  avg_cost         numeric not null default 0,                   -- ⚠️ camel patch writes "avgCost"
  mark_price       numeric,                                      -- ⚠️ camel patch writes "markPrice"
  unit_label       text not null default 'shares',
  currency         text not null default 'USD',
  updated_at       timestamptz
);
create index if not exists sub_holdings_sleeve_idx on "subPortfolioHoldings" (sub_portfolio_id);

-- ============================================================= portfolioSnapshots
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

-- ============================================================= crmLeads
create table if not exists "crmLeads" (
  id               uuid primary key default gen_random_uuid(),
  first_name       text not null default '',
  last_name        text not null default '',
  company          text,
  phone_e164       text,
  email            text,
  country          text,
  tags             text[] not null default '{}',
  status           text not null default 'new' check (status in ('new','working','customer','dead')),
  source           jsonb not null default '{"kind":"manual"}',  -- {kind,batchId?,file?,mission?}
  consent_basis    text not null default 'unknown'
                   check (consent_basis in ('inquiry','existing_business','purchased_list','unknown')),
  consent_note     text,                                        -- ⚠️ updateLead writes camel "consentNote"
  gi_lead_id       text,
  payload          jsonb,                                       -- GI dossier
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  last_exported_at timestamptz
);
create index if not exists crm_leads_created_idx  on "crmLeads" (created_at desc);
create index if not exists crm_leads_email_idx    on "crmLeads" (email);
create index if not exists crm_leads_phone_idx    on "crmLeads" (phone_e164);

-- ============================================================= crmImports
create table if not exists "crmImports" (
  id                 uuid primary key default gen_random_uuid(),
  "files"            jsonb not null default '[]',
  "mapping"          jsonb not null default '{}',
  "consentBasis"     text not null default 'unknown',
  "counts"           jsonb not null default '{}',
  "confirmedBy"      text not null default '',
  "confirmedByEmail" text not null default '',
  created_at         timestamptz default now()
);
create index if not exists crm_imports_created_idx on "crmImports" (created_at desc);

-- ============================================================= crmSuppression
create table if not exists "crmSuppression" (
  id       uuid primary key default gen_random_uuid(),
  "type"   text not null check ("type" in ('email','phone')),
  "value"  text not null,
  reason   text not null default 'manual' check (reason in ('unsubscribe','bounce','complaint','manual')),
  source   text,
  added_at timestamptz default now()
);
create index if not exists crm_supp_value_idx on "crmSuppression" ("value");
create unique index if not exists crm_supp_type_value_uidx on "crmSuppression" ("type", "value");

-- ============================================================= crmInstruments
create table if not exists "crmInstruments" (
  id                       text primary key default gen_random_uuid()::text,
  slug                     text not null unique,
  name                     text not null,
  asset_class              text not null default 'other',       -- ⚠️ camel seeds/patches write "assetClass"
  status                   text not null default 'active',
  landing                  jsonb not null default '{}',         -- nested keys camelCase
  risk_disclosure          text not null default '',
  default_appointment_url  text not null default '',
  default_demo_url         text not null default '',
  default_steps            jsonb,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

-- ============================================================= crmCampaigns
create table if not exists "crmCampaigns" (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  track           text,                                         -- legacy alias
  instrument_slug text,                                         -- mapper prefers this
  status          text not null default 'draft',
  steps           jsonb not null default '[]',
  settings        jsonb not null default '{}',
  stats           jsonb not null default '{}',
  created_by      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists crm_campaigns_created_idx on "crmCampaigns" (created_at desc);

-- ============================================================= crmEnrollments
create table if not exists "crmEnrollments" (
  id             text primary key,                              -- `${campaignId}_${leadId}`
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
  funnel_stage   text,                                          -- 'sequenced'|'converted'|'exited'|...
  unique (campaign_id, lead_id)
);
create index if not exists crm_enr_campaign_idx on "crmEnrollments" (campaign_id);

-- ============================================================= crmInbound
create table if not exists "crmInbound" (
  id                 uuid primary key default gen_random_uuid(),
  gi_lead_id         text not null,
  mission            text not null default 'unspecified',
  segment            text not null default 'investor-prospect',
  lead               jsonb not null default '{}',               -- {firstName…consentSource,tags} both casings read
  dossier            jsonb not null default '{}',
  status             text not null default 'pending' check (status in ('pending','accepted','declined')),
  received_at        timestamptz default now(),
  reviewed_by_email  text,
  reviewed_at        timestamptz,
  decline_reason     text
);
create index if not exists crm_inbound_status_idx on "crmInbound" (status, received_at desc);

-- ============================================================= counters (auxiliary, used by investor flows)
create table if not exists "counters" (
  id    text primary key,                                       -- 'funding-2026', 'invoices-2026', ...
  value integer not null default 0
);

-- ⛔ NOT drafted (zero browser usage — shape from the SQL functions instead):
--   walletTransactions, cashLedger (RPC-managed), crmEmailEvents (functions-crm worker), crmSources.
```

### Timestamp mirror trigger pattern

Generated columns cannot mirror `timestamptz` (the cast is not immutable), so the dual-spelled
timestamp pairs above (`"createdAt"`/`created_at`, `"updatedAt"`/`updated_at`, `"planSince"`/`plan_since`,
`"executedAt"`/`executed_at`, `"filledAt"`, `"cancelledAt"`) need a simple `BEFORE` trigger.
One small per-table trigger each, for example:

```sql
create or replace function profiles_ts_sync() returns trigger as $$
begin
  if new."createdAt" is not null and (new.created_at is null or new.created_at <> new."createdAt")
    then new.created_at := new."createdAt"; end if;
  if new.created_at is not null and new."createdAt" is null then new."createdAt" := new.created_at; end if;
  if new.updated_at is not null and (new."updatedAt" is null or new."updatedAt" <> new.updated_at)
    then new."updatedAt" := new.updated_at; end if;
  if new."updatedAt" is not null and new.updated_at is null then new.updated_at := new."updatedAt"; end if;
  if new.plan_since is not null and new."planSince" is null then new."planSince" := new.plan_since; end if;
  return new;
end $$ language plpgsql;

create trigger profiles_ts_sync before insert or update on "profiles"
  for each row execute function profiles_ts_sync();
```

Repeat the same 4–6 line pattern for `adminOrders`, `trades`, `assets`, `auditLogs`,
`portfolioHoldings` (only `updated_at` — no camel pair needed there).

### Also needed for migration

- **RLS**: every table filters by `user_id = auth.uid()` (or staff/admin checks for
  `staffNotifications`, `auditLogs`, `assets`, `assetGroups`, CRM tables — staff-only by rule).
- **Realtime publication** must include: `wallets`, `fundingRequests`, `clientNotifications`,
  `staffNotifications`, `assets`.
- **Realtime filters used in code**: `user_id=eq.{uid}` (wallets, fundingRequests,
  clientNotifications), `id=eq.{symbol}` (assets), no filter (staffNotifications).
- **RPCs referenced by code** (must exist server-side): `confirm_funding_receipt`,
  `record_client_deposit`, `backfill_deposit_ledger`, `place_order_on_behalf`, `fill_order`,
  `mark_order_working`, `reject_order`, `cancel_order`, `update_trade_contract`,
  `generate_account_statement`, `run_portfolio_snapshot_now`.
- `updated_at`: code always writes it explicitly with `nowISO()` on update paths; a
  `moddatetime`-style trigger is still recommended as a backstop.
- JSON-ish columns kept as `jsonb`: profiles `address`/`employment`/`investmentProfile`/`compliance`/
  `accountManager`, fundingRequests/invoices `payment_proofs`, invoices `line_items`, trades/orders
  nested option objects, assets `quote`, platformSettings `cryptoWallets`, crmLeads `source`/`payload`,
  crmImports `files`/`mapping`/`counts`, crmInstruments `landing`/`default_steps`,
  crmCampaigns `steps`/`settings`/`stats`, crmInbound `lead`/`dossier`, aiSignals `indicators`.
