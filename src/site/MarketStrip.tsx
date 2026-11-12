/**
 * Live market strip — real desk-posted marks from the platform's asset catalog.
 * Polls `assets` (anon policy added in migration 0004). Degrades to a static
 * instrument list until that policy is run or the network is unavailable.
 */
import { useEffect, useState } from 'react';

interface Quote {
  price: number;
  change?: number;
  changePercent?: number;
}

interface Row {
  id: string;
  name: string;
  quote?: Quote | null;
}

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

function fmt(n: number | undefined) {
  if (n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MarketStrip() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!supabaseUrl || !anonKey) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/assets?is_active=eq.true&select=id,name,quote&order=id.asc&limit=8`,
          { headers: { apikey: anonKey } },
        );
        if (!res.ok) return;
        const data = (await res.json()) as Row[];
        if (alive && Array.isArray(data)) setRows(data);
      } catch {
        /* strip stays with last good data */
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!rows.length) return null;

  return (
    <div className="sgs-strip" role="region" aria-label="Desk-posted market marks">
      <div className="sgs-strip-inner">
        {rows.map((r) => {
          const pct = r.quote?.changePercent ?? 0;
          const up = pct > 0;
          const down = pct < 0;
          return (
            <span className="sgs-strip-item" key={r.id}>
              <span className="sgs-strip-sym">{r.id}</span>
              <span className="sgs-strip-name">{r.name}</span>
              <span className="sgs-strip-price">{fmt(r.quote?.price)}</span>
              {up || down ? (
                <span className={`sgs-strip-chg ${up ? 'is-up' : 'is-down'}`}>
                  {up ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
                </span>
              ) : (
                <span className="sgs-strip-chg">Desk mark</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
