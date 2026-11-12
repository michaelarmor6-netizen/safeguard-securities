import { Link } from 'react-router-dom';
import { Reveal } from './Reveal';

const STRATEGY_DETAIL: Record<string, string> = {
  Equities: 'Core and tactical equity exposures built for long-term growth, liquidity and measured downside protection.',
  'Multi-Asset': 'Blended allocations across asset classes, rebalanced with intention as regimes shift.',
  'Real Estate': 'Sector exposure with an eye on income, cycles and measured leverage.',
  Healthcare: 'Defensive growth across an industry with durable demand.',
  Infrastructure: 'Income and stability from essential, long-lived assets.',
  'Top Dividend': 'Yield-focused strategies with balance-sheet quality screens.',
  'Consumer Discretionary': 'Cyclical exposure managed with position-level limits.',
  'Tech Giants': 'Large-cap growth with valuation discipline.',
  'Energy & Utilities': 'Value and income across the energy transition.',
};

const INSTRUMENTS = [
  'Stocks',
  'Options',
  'ETFs',
  'Bonds',
  'Futures',
  'Cryptocurrency',
  'IPOs',
  'M&A',
];

const PLATFORMS = [
  {
    title: 'Investor Workspace',
    body: 'A browser-based dashboard for your whole account: holdings with live desk marks, wallet balance, performance history, watchlist, news and research.',
  },
  {
    title: 'Trade Desk',
    body: 'Direct desk execution with a fill ledger you can read. Every trade carries its reference, price, fees and settlement — and orders can be placed on your behalf by the desk.',
  },
  {
    title: 'AI Engine insights',
    body: 'The proprietary strategy engine synthesises quantitative models and alternative data into allocations, with signals and risk posture explained in plain language.',
  },
  {
    title: 'Mobile access',
    body: 'An installable app for iOS and Android: your dashboard, marks and records travel with you and install to your home screen.',
  },
];

const SERVICES = [
  {
    title: 'Wallet & funding',
    body: 'Fund by bank wire to a wallet ledger. The funding desk confirms every deposit with a reference and receipt; withdrawals are requested and processed against the same ledger.',
  },
  {
    title: 'Statements & reporting',
    body: 'Account statements generated on demand — month to date or any period — exportable and printable, built from the ledger the desk trades against.',
  },
  {
    title: 'Research & news',
    body: 'Concise research notes, scenario analysis and practical trade context, plus streaming market news inside your workspace.',
  },
  {
    title: 'Client support',
    body: 'Support tickets answered by the desk, with your account manager reachable directly for anything that needs a conversation.',
  },
];

export default function ServicesPage() {
  return (
    <main>
      <section className="sgs-hero sgs-page-hero">
        <div className="sgs-wrap">
          <div className="sgs-slide-content" style={{ padding: '72px 0' }}>
            <h1>Institutional brokerage, built for clarity.</h1>
            <p>
              Strategies, execution, funding and reporting — one account, one ledger, and a desk
              that answers.
            </p>
          </div>
        </div>
      </section>

      <section className="sgs-section" id="strategies">
        <div className="sgs-wrap">
          <Reveal className="sgs-eyebrow-row" as="div">
            <h2>Sector strategies</h2>
          </Reveal>
          <div className="sgs-strategies">
            {Object.entries(STRATEGY_DETAIL).map(([name, body]) => (
              <Reveal className="sgs-prop" key={name} as="div" style={{ padding: '22px 22px' }}>
                <h3>{name}</h3>
                <p>{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="sgs-section sgs-section-alt" id="instruments">
        <div className="sgs-wrap">
          <Reveal className="sgs-eyebrow-row" as="div">
            <h2>Instruments &amp; markets</h2>
          </Reveal>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {INSTRUMENTS.map((i) => (
              <span
                key={i}
                style={{
                  border: '1px solid var(--sgs-line)',
                  borderRadius: 999,
                  padding: '10px 20px',
                  fontWeight: 600,
                  fontSize: 14.5,
                  background: '#fff',
                }}
              >
                {i}
              </span>
            ))}
          </div>
          <p style={{ marginTop: 22, color: 'var(--sgs-muted)', maxWidth: 66 }}>
            Traded across 40+ global venues with deep liquidity and transparent pricing, including
            direct US market access to NYSE, NASDAQ and CBOE with pre-trade controls.
          </p>
        </div>
      </section>

      <section className="sgs-section" id="platforms">
        <div className="sgs-wrap">
          <Reveal className="sgs-eyebrow-row" as="div">
            <h2>Platforms</h2>
          </Reveal>
          <div className="sgs-props sgs-cols-2">
            {PLATFORMS.map((p) => (
              <Reveal className="sgs-prop" key={p.title} as="div">
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="sgs-section sgs-section-alt" id="services">
        <div className="sgs-wrap">
          <Reveal className="sgs-eyebrow-row" as="div">
            <h2>Account services</h2>
          </Reveal>
          <div className="sgs-props sgs-cols-2">
            {SERVICES.map((s) => (
              <Reveal className="sgs-prop" key={s.title} as="div">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </Reveal>
            ))}
          </div>
          <p style={{ marginTop: 26, fontSize: 13, color: 'var(--sgs-muted)', maxWidth: '78ch' }}>
            Fee schedules, funding instructions and disclosures are provided by the desk on request.
            All forms of investment carry risk, including possible loss of principal.
          </p>
          <div style={{ marginTop: 32 }}>
            <Link to="/contact" className="sgs-btn-solid">
              Request the fee schedule
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
