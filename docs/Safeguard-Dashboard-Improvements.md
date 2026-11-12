# Safeguard Securities — Client Dashboard Improvements & Trading Dashboard Recommendations

**Date:** November 2026  
**Project:** e-bank_dashboard (migrating from Firebase to Supabase)

---

## 1. Summary of Work Completed

### Email Templates
- Polished 13+ HTML email templates with permanent base64-embedded logos
- Standardized professional neutral color palette (black/gray/white)
- Created new follow-up call scheduling template
- Converted Wise-to-Revolut NZD transfer guide into a clean email

### Client Dashboard UI Improvements
- Redesigned layout with personalized greeting
- Added 4 KPI cards: Total Account Value, Available Cash, Unrealized P&L, Open Positions
- Added Quick Actions row (Upload Document, Schedule Call, Statements, Support)
- Introduced **Open Positions** table (Portfolio module)
- Improved empty states and visual hierarchy
- Shifted focus from pure banking to securities/investment context

### Backend Migration (Firebase → Supabase)
- Created free Supabase project (`new-sg-ebank-dashboard`)
- Designed and created tables: `accounts`, `positions`, `transactions`, `countries`
- Enabled Row Level Security policies
- Exported Firestore data via Node.js script
- Successfully imported accounts, transactions, and countries into Supabase
- Deployed frontend to Vercel (`e_bank_dashboard_supabase` repo)
- Rebuilt `AuthContext` and `InvestorAuthContext` to use Supabase Auth
- Updated `App.tsx` to remove Firebase dependencies while preserving routes
- Resolved multiple Vite/Rollup build issues with Firebase stubbing during transition

### Current Technical State
- Frontend: Vite + React + TypeScript + Tailwind
- Backend: Supabase (Auth + PostgreSQL)
- Hosting: Vercel
- Dashboard loads accounts from Supabase
- Positions module ready (shows empty state until data is added)

---

## 2. Recommendations: Turning the Dashboard into a Trading Dashboard

The current dashboard is still closer to a banking overview. To make it feel like a professional trading / investment platform (especially for gold futures and limited-risk options), implement the following.

### A. Core Trading Modules to Add

| Module              | Priority | Description |
|---------------------|----------|-------------|
| Portfolio Overview  | High     | Asset allocation, total P&L, day change |
| Positions Table     | High     | Expandable rows, live-ish prices, close buttons |
| Watchlist           | High     | Gold, Silver, major futures symbols |
| Order Entry         | Medium   | Simple buy/sell or strategy ticket |
| Trade History       | Medium   | Filled orders and closed positions |
| Performance Chart   | High     | Equity curve or portfolio value over time |
| Risk Metrics        | Medium   | Margin used, buying power, exposure |

### B. Suggested Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ Header: Greeting + Account Selector + Quick Trade       │
├──────────────┬──────────────────────────────────────────┤
│              │  KPI Strip (Value • Cash • P&L • Margin) │
│   Sidebar    ├──────────────────────────────────────────┤
│              │  Mini Chart (Portfolio / Gold)           │
│              ├──────────────────┬───────────────────────┤
│              │  Open Positions  │  Watchlist / News     │
│              │  (main table)    │                       │
│              ├──────────────────┴───────────────────────┤
│              │  Recent Activity / Orders                │
└──────────────┴──────────────────────────────────────────┘
```

### C. Visual & UX Recommendations

- **Color system**: Keep neutral base. Use green/red only for P&L. Consider a subtle dark mode option for trading feel.
- **Typography**: Larger numbers for prices and P&L. Monospace font for prices and quantities.
- **Density**: Tighter spacing in the positions table (trading users prefer information density).
- **Charts**: Use `lightweight-charts` (already present in the codebase) for portfolio and price charts.
- **Real-time feel**: Even without live market data, show “last updated” timestamps and animate number changes.
- **Empty states**: Strong CTAs (“Contact advisor to open a gold futures position”).

### D. Data Model Additions (Supabase)

```sql
-- Positions (already created, expand as needed)
-- Add columns: symbol, side, multiplier, margin_requirement, last_price_update

-- Watchlist
create table watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  symbol text not null,
  created_at timestamptz default now()
);

-- Orders / Trades
create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  symbol text,
  side text, -- buy / sell
  quantity numeric,
  order_type text, -- market / limit
  status text, -- pending / filled / cancelled
  filled_price numeric,
  created_at timestamptz default now()
);
```

### E. Implementation Priority

1. **Phase 1 (1–2 days)**  
   - Polish existing Positions table  
   - Add portfolio value chart placeholder  
   - Add Watchlist component  
   - Improve KPI cards with day change

2. **Phase 2**  
   - Order entry form (even if it creates a “request” for the advisor)  
   - Trade history page  
   - Better mobile responsiveness

3. **Phase 3**  
   - Connect real or delayed market data (if available)  
   - Margin and risk calculations  
   - Notifications for price alerts

### F. Quick Wins for Immediate Visual Upgrade

- Add a small area chart under the main KPIs
- Color the P&L column more prominently
- Add a “Market Overview” card showing Gold and Silver prices (static or from a free API)
- Move “Schedule Call” and “Contact Advisor” into a persistent header action
- Use icons consistently in the sidebar for trading concepts (Positions, Watchlist, Orders)

---

## 3. Next Immediate Steps

1. Confirm the Supabase-powered dashboard loads correctly on Vercel
2. Seed a few sample positions in the `positions` table to see the table in action
3. Implement the Watchlist + mini chart (highest visual impact)
4. Gradually replace remaining Firebase-dependent pages with Supabase versions

---

**Document prepared for Safeguard Securities client dashboard evolution.**
