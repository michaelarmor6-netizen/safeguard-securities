/**
 * True-size interface fragments rebuilt from the SafeGuard investor platform.
 * Every fragment root carries `data-ui` (the product's own chrome).
 * Values shown are the platform's verified demo-account artifacts — swap for
 * anonymised figures before a public marketing push if desired.
 */
import { useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------- reveal helper */

let revealObserver: IntersectionObserver | null = null;

/** Adds `is-in` once when the element enters the viewport. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-in');
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add('is-in');
              revealObserver?.unobserve(e.target);
            }
          }
        },
        { rootMargin: '0px 0px -12% 0px', threshold: 0.1 },
      );
    }
    revealObserver.observe(el);
    return () => revealObserver!.unobserve(el);
  }, []);
  return ref;
}

/* ----------------------------------------------------------- wallet plate */

const HOLDINGS = [
  { sym: 'GC', name: 'Gold', qty: '3 contracts', value: '$7,255.20', alloc: '12.5%' },
  { sym: 'SI', name: 'Silver', qty: '3 contracts', value: '$92.70', alloc: '0.2%' },
  { sym: 'AAPL', name: 'Apple Inc.', qty: '150 shares', value: '$28,860.00', alloc: '49.7%' },
  { sym: 'SPY', name: 'SPDR S&P 500', qty: '40 shares', value: '$21,832.00', alloc: '37.6%' },
];

/**
 * The investor dashboard, shown whole like a plate in a manual.
 * `dim` + `lit` come from the margin notes: hovering a note keeps its
 * matching row at full strength and drops the rest to 30%.
 */
export function WalletPlate({ dim, lit }: { dim?: string | null; lit?: string | null }) {
  const cls = (part: string) =>
    `sgs-dimmable${dim && lit === part ? ' sgs-lit' : ''}`;
  return (
    <div className={`sgs-ui sgs-plate-panel${dim ? ' sgs-dim' : ''}`} data-ui>
      <div className={cls('total')}>
        <div className="sgs-ui-head">
          <span className="sgs-ui-title">Portfolio</span>
          <span className="sgs-ui-pill">Desk marked</span>
        </div>
        <div className="sgs-ui-body">
          <div className="sgs-ui-label">Wallet balance</div>
          <div className="sgs-ui-value">$32,576.75</div>
          <div className="sgs-ui-row" style={{ paddingInline: 0 }}>
            <span className="sgs-ui-sub">Total value</span>
            <span className="sgs-ui-num" style={{ fontSize: 16, fontWeight: 600 }}>
              $58,039.90
            </span>
          </div>
          <div className="sgs-ui-row" style={{ paddingInline: 0 }}>
            <span className="sgs-ui-sub">Total gain</span>
            <span className="sgs-ui-num sgs-ui-pos" style={{ fontSize: 16, fontWeight: 600 }}>
              +$3,604.95
            </span>
          </div>
        </div>
      </div>
      <div className={cls('holdings')}>
        <div className="sgs-ui-head" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="sgs-ui-title">Your holdings</span>
          <span className="sgs-ui-sub">4 positions</span>
        </div>
        <div className="sgs-ui-body" style={{ paddingTop: 6, paddingBottom: 12 }}>
          {HOLDINGS.map((h) => (
            <div key={h.sym} className="sgs-ui-row">
              <span>
                <span className="sgs-ui-sym">{h.sym}</span>
                <span className="sgs-ui-sub"> · {h.name}</span>
              </span>
              <span className="sgs-ui-num">
                {h.value}
                <span className="sgs-ui-sub"> · {h.alloc}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className={cls('history')}>
        <div className="sgs-ui-head" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="sgs-ui-title">Trade history</span>
        </div>
        <div className="sgs-ui-body" style={{ paddingTop: 6, paddingBottom: 14 }}>
          <div className="sgs-ui-row">
            <span className="sgs-ui-num" style={{ textAlign: 'left' }}>BUY · GC · 1</span>
            <span className="sgs-ui-num sgs-ui-pos">Filled @ 2,415.75</span>
          </div>
          <div className="sgs-ui-row">
            <span className="sgs-ui-sub">Trade reference</span>
            <span className="sgs-ui-num">SG-T-F3366CDD</span>
          </div>
        </div>
      </div>
      <div className={cls('statement')}>
        <div className="sgs-ui-head" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="sgs-ui-title">Statement</span>
        </div>
        <div className="sgs-ui-body" style={{ paddingTop: 6, paddingBottom: 16 }}>
          <div className="sgs-ui-row">
            <span className="sgs-ui-sub">Period</span>
            <span className="sgs-ui-num">Month to date</span>
          </div>
          <div className="sgs-ui-row">
            <span className="sgs-ui-sub">Format</span>
            <span className="sgs-ui-num">PDF · CSV</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- call & response */

/** The literal thing the client submits: a funding instruction. */
export function DepositCall() {
  return (
    <div className="sgs-ui" data-ui>
      <div className="sgs-ui-body">
        <div className="sgs-ui-label">Funding request</div>
        <div className="sgs-ui-row" style={{ paddingInline: 0 }}>
          <span className="sgs-ui-sub">Amount</span>
          <span className="sgs-ui-num" style={{ fontSize: 17, fontWeight: 600 }}>
            $25,000.00
          </span>
        </div>
        <div className="sgs-ui-row" style={{ paddingInline: 0 }}>
          <span className="sgs-ui-sub">Method</span>
          <span className="sgs-ui-num">Bank wire</span>
        </div>
        <div className="sgs-ui-row" style={{ paddingInline: 0 }}>
          <span className="sgs-ui-sub">Reference</span>
          <span className="sgs-ui-num">SG-FUND2600001</span>
        </div>
      </div>
    </div>
  );
}

/** What comes back: the wallet ledger line. */
export function DepositRecord() {
  return (
    <div className="sgs-ui" data-ui>
      <div className="sgs-ui-body">
        <div className="sgs-ui-row" style={{ paddingInline: 0 }}>
          <span className="sgs-ui-sym">Deposit confirmed</span>
          <span className="sgs-ui-num sgs-ui-pos">+$25,000.00</span>
        </div>
        <div className="sgs-ui-row" style={{ paddingInline: 0 }}>
          <span className="sgs-ui-sub">Wallet balance</span>
          <span className="sgs-ui-num" style={{ fontWeight: 600 }}>$25,000.00</span>
        </div>
      </div>
    </div>
  );
}

/** The literal thing the desk receives: an order ticket. */
export function OrderCall() {
  return (
    <div className="sgs-ui" data-ui>
      <div className="sgs-ui-body">
        <div className="sgs-ui-label">Order ticket</div>
        <div className="sgs-ui-row" style={{ paddingInline: 0 }}>
          <span className="sgs-ui-num" style={{ textAlign: 'left', fontSize: 17, fontWeight: 600 }}>
            BUY · GC · 1 contract
          </span>
        </div>
        <div className="sgs-ui-row" style={{ paddingInline: 0 }}>
          <span className="sgs-ui-sub">Instrument</span>
          <span className="sgs-ui-num">Gold futures</span>
        </div>
        <div className="sgs-ui-row" style={{ paddingInline: 0 }}>
          <span className="sgs-ui-sub">Execution</span>
          <span className="sgs-ui-num">Market</span>
        </div>
      </div>
    </div>
  );
}

/** What comes back: the fill. */
export function FillRecord() {
  return (
    <div className="sgs-ui" data-ui>
      <div className="sgs-ui-body">
        <div className="sgs-ui-row" style={{ paddingInline: 0 }}>
          <span className="sgs-ui-sym">Filled</span>
          <span className="sgs-ui-num">@ 2,415.75</span>
        </div>
        <div className="sgs-ui-row" style={{ paddingInline: 0 }}>
          <span className="sgs-ui-sub">Trade reference</span>
          <span className="sgs-ui-num">SG-T-F3366CDD</span>
        </div>
        <div className="sgs-ui-row" style={{ paddingInline: 0 }}>
          <span className="sgs-ui-sub">Settled to wallet</span>
          <span className="sgs-ui-num">−$2,423.25</span>
        </div>
      </div>
    </div>
  );
}

/** The finished result: the account statement, wide. */
export function StatementRecord() {
  return (
    <div className="sgs-ui" data-ui>
      <div className="sgs-ui-head">
        <span className="sgs-ui-title">Account statement</span>
        <span className="sgs-ui-sub">Month to date</span>
      </div>
      <div className="sgs-ui-body">
        <div className="sgs-ui-row">
          <span>
            <span className="sgs-ui-sub">Opening wallet</span>
          </span>
          <span className="sgs-ui-num">$25,000.00</span>
        </div>
        <div className="sgs-ui-row">
          <span>
            <span className="sgs-ui-sub">Purchase · GC · SG-T-F3366CDD</span>
          </span>
          <span className="sgs-ui-num">−$2,423.25</span>
        </div>
        <div className="sgs-ui-row">
          <span>
            <span className="sgs-ui-sub">Marked positions, 4</span>
          </span>
          <span className="sgs-ui-num sgs-ui-pos">+$3,604.95</span>
        </div>
        <div className="sgs-ui-row">
          <span>
            <span className="sgs-ui-sym">Closing wallet</span>
          </span>
          <span className="sgs-ui-num" style={{ fontSize: 17, fontWeight: 600 }}>$32,576.75</span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- showcase record */

/** The tidy record shown on the paper half of the showcase. */
export function ShowRecord({ instruction }: { instruction: string }) {
  const firstLine = instruction.split('\n')[0].slice(0, 46) || '—';
  return (
    <div className="sgs-ui sgs-ui-light" data-ui>
      <div className="sgs-ui-head">
        <span className="sgs-ui-title">Instruction · recorded</span>
        <span className="sgs-ui-pill">Entered</span>
      </div>
      <div className="sgs-ui-body">
        <div className="sgs-ui-row">
          <span className="sgs-ui-sub">{firstLine}</span>
          <span className="sgs-ui-num">Logged</span>
        </div>
        <div className="sgs-ui-row">
          <span className="sgs-ui-sub">Strategy · Growth</span>
          <span className="sgs-ui-num">Allocated</span>
        </div>
        <div className="sgs-ui-row">
          <span className="sgs-ui-sub">Bands · 40% eq / 30% metals</span>
          <span className="sgs-ui-num">Risk-set</span>
        </div>
        <div className="sgs-ui-row">
          <span className="sgs-ui-sub">Statement</span>
          <span className="sgs-ui-num">Monthly</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- desk clock */

const NYSE_OPEN = { h: 9, m: 30 };
const NYSE_CLOSE = { h: 16, m: 0 };

function etParts(now: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const hm = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  const [h, m] = hm.split(':').map(Number);
  return { h, m, weekday: parts.weekday, display: `${parts.hour}:${parts.minute}:${parts.second} ${parts.dayPeriod.toLowerCase()}` };
}

/**
 * The one live thing: the trading desk's real session clock.
 * The platform runs on America/New_York (its deskTimezone setting).
 */
export function DeskClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { h, m, weekday, display } = etParts(now);
  const minutes = h * 60 + m;
  const weekend = weekday === 'Sat' || weekday === 'Sun';
  const open = !weekend && minutes >= NYSE_OPEN.h * 60 + NYSE_OPEN.m && minutes < NYSE_CLOSE.h * 60 + NYSE_CLOSE.m;

  return (
    <div className="sgs-clock" data-ui>
      <div className="sgs-clock-time">{display}</div>
      <div className="sgs-clock-zone">New York · desk time</div>
      <div className="sgs-clock-state">
        <span className={`sgs-clock-dot${open ? '' : ' is-closed'}`} />
        {open
          ? 'The desk is open'
          : weekend
            ? 'Desk closed · reopens Monday'
            : minutes < NYSE_OPEN.h * 60 + NYSE_OPEN.m
              ? 'Desk opens 9:30 AM ET'
              : 'Desk closed for the day'}
      </div>
    </div>
  );
}
