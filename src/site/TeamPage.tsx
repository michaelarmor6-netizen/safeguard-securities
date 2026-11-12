import { Link } from 'react-router-dom';
import { Reveal } from './Reveal';

const DESKS = [
  {
    title: 'Advisory desk',
    body: 'Your first conversation. The advisory desk reviews your objectives, risk tolerance and time horizon, and maps a strategy that fits before anything is funded.',
  },
  {
    title: 'Trading desk',
    body: 'Where marks and fills come from. The trading desk posts prices, executes orders, and maintains the fill ledger every client record is built on.',
  },
  {
    title: 'Operations & funding',
    body: 'Confirms deposits, processes withdrawals and keeps the wallet ledger exact — a receipt and reference for every dollar that moves.',
  },
  {
    title: 'Compliance & audit',
    body: 'Reviews accounts, monitors activity and keeps the audit trail complete, so statements and records stand up to scrutiny.',
  },
  {
    title: 'Client support',
    body: 'Your day-to-day contact. Support handles tickets, documentation and account changes, and reaches the right desk when it needs one.',
  },
];

export default function TeamPage() {
  return (
    <main>
      <section className="sgs-hero sgs-page-hero">
        <div className="sgs-wrap">
          <div className="sgs-slide-content" style={{ padding: '72px 0' }}>
            <h1>The desks behind your account.</h1>
            <p>
              Safeguard Securities is organised the way your money is managed: five desks, each with
              a defined job, working from the same ledger.
            </p>
          </div>
        </div>
      </section>

      <section className="sgs-section">
        <div className="sgs-wrap">
          <Reveal className="sgs-eyebrow-row" as="div">
            <h2>Five desks, one record</h2>
          </Reveal>
          <div className="sgs-strategies sgs-cols-2" style={{ gap: 22 }}>
            {DESKS.map((d) => (
              <Reveal className="sgs-prop" key={d.title} as="div">
                <h3>{d.title}</h3>
                <p>{d.body}</p>
              </Reveal>
            ))}
          </div>
          <p style={{ marginTop: 30, color: 'var(--sgs-muted)', maxWidth: 66 }}>
            Desk biographies are published with our public launch. In the meantime, the advisory
            desk can introduce the people who would work on your account —{' '}
            <Link to="/contact" style={{ color: 'var(--sgs-action)', fontWeight: 600 }}>
              ask us
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="sgs-section sgs-section-alt">
        <div className="sgs-wrap sgs-live-inner">
          <Reveal className="sgs-live-copy" as="div">
            <h2>Work with people who sign their work.</h2>
            <p>
              Every mark, fill and statement on your account comes from a named desk. Come and meet
              them.
            </p>
          </Reveal>
          <Link to="/contact" className="sgs-btn-gold">
            Contact the team
          </Link>
        </div>
      </section>
    </main>
  );
}
