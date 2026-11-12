import { Link } from 'react-router-dom';
import { Reveal } from './Reveal';

const STANDARDS = [
  {
    title: 'Desk-posted marks',
    body: 'Prices are posted by our trading desk for every instrument clients hold — dated the day they are set, and free of third-party aggregator noise. Your portfolio is valued from the same record the desk trades against.',
  },
  {
    title: 'A ledger you can audit',
    body: 'Every deposit, fee and fill is recorded against your wallet with its own reference. Statements are generated on demand from that ledger — nothing is reconstructed after the fact.',
  },
  {
    title: 'Position-level risk limits',
    body: 'Every strategy runs with defined position sizing and drawdown limits. The AI engine monitors order flow, sentiment and macro indicators continuously and adjusts to changing regimes.',
  },
];

export default function AboutPage() {
  return (
    <main>
      <section className="sgs-hero sgs-page-hero">
        <div className="sgs-wrap">
          <div className="sgs-slide-content" style={{ padding: '72px 0' }}>
            <h1>Institutional discipline, in practice.</h1>
            <p>
              Safeguard Securities is an institutional investment and brokerage firm for serious
              investors. We manage capital the way we would run our own: preservation first,
              discipline in every decision, and a record you can read.
            </p>
          </div>
        </div>
      </section>

      <section className="sgs-section">
        <div className="sgs-wrap" style={{ maxWidth: 860 }}>
          <Reveal as="div">
            <h2 style={{ fontSize: 'clamp(24px, 2.4vw, 32px)' }}>The firm</h2>
            <div className="sgs-trust-copy">
              <p>
                We help serious investors make better decisions with clear strategy, active risk
                controls, and direct access to global markets. Our analysts combine valuation work,
                market structure and momentum signals to uncover opportunities with defined risk.
              </p>
              <p>
                Clients hold their investments in a unified account across equities, options, ETFs,
                bonds, futures, IPOs, M&A and digital assets — funded by wire, tracked on a wallet
                ledger, and marked daily by our trading desk.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="sgs-section sgs-section-alt" id="investing">
        <div className="sgs-wrap">
          <Reveal className="sgs-eyebrow-row" as="div">
            <h2>How we invest</h2>
          </Reveal>
          <div className="sgs-steps">
            <Reveal className="sgs-step" as="div">
              <h3>Preserve first</h3>
              <p>
                Our process starts with capital preservation. Allocation ranges, liquidity needs and
                risk tolerance are set before anything is bought.
              </p>
            </Reveal>
            <Reveal className="sgs-step" as="div">
              <h3>Compound deliberately</h3>
              <p>
                We combine macro context, sector research and position-level risk limits so every
                allocation has a clear purpose in your portfolio.
              </p>
            </Reveal>
            <Reveal className="sgs-step" as="div">
              <h3>Stay aligned</h3>
              <p>
                We monitor risk daily and rebalance with intention, so your portfolio stays aligned
                as markets move and your objectives evolve.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="sgs-section" id="standards">
        <div className="sgs-wrap">
          <Reveal className="sgs-eyebrow-row" as="div">
            <h2>What we require of ourselves</h2>
          </Reveal>
          <div className="sgs-props sgs-cols-3">
            {STANDARDS.map((s) => (
              <Reveal className="sgs-prop" key={s.title} as="div">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </Reveal>
            ))}
          </div>
          <p style={{ marginTop: 32, fontSize: 13, color: 'var(--sgs-muted)', maxWidth: '78ch' }}>
            Regulatory registration, disclosures and forms are available on request from the desk.
            All forms of investment carry risk, including possible loss of principal.
          </p>
          <div style={{ marginTop: 36 }}>
            <Link to="/contact" className="sgs-btn-solid">
              Talk with an investment strategist
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
