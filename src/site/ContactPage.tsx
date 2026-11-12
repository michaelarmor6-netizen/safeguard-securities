import { useState } from 'react';
import { DeskClock } from './fragments';
import { Reveal } from './Reveal';

const SUPPORT_EMAIL = 'support@safeguardsecurities.us';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  // No public backend for the marketing site: the form composes the visitor's
  // own email client, addressed to the desk. Honest and dependency-free.
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Strategy call request — ${name || 'website inquiry'}`);
    const body = encodeURIComponent(`${message}\n\n—\n${name}\n${email}`);
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  const field = 'sgs-field';

  return (
    <main>
      <section className="sgs-hero sgs-page-hero">
        <div className="sgs-wrap">
          <div className="sgs-slide-content" style={{ padding: '72px 0' }}>
            <h1>Talk with an investment strategist.</h1>
            <p>
              Review your objectives with the advisory desk and map a strategy that fits your risk
              profile and timeline.
            </p>
          </div>
        </div>
      </section>

      <section className="sgs-section">
        <div className="sgs-wrap sgs-contact-grid">
          <Reveal as="div">
            <h2 style={{ fontSize: 22, marginBottom: 22 }}>Direct to the desk</h2>
            <div className="sgs-trust-copy">
              <p>
                <strong>Phone</strong>
                <br />
                <a href="tel:+19379821491" style={{ color: 'var(--sgs-action)', fontWeight: 600 }}>
                  +1 937 982 1491
                </a>
              </p>
              <p>
                <strong>Email</strong>
                <br />
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  style={{ color: 'var(--sgs-action)', fontWeight: 600 }}
                >
                  {SUPPORT_EMAIL}
                </a>
              </p>
              <p>
                <strong>Office</strong>
                <br />
                6060 Parkland Boulevard, Suite 200
                <br />
                Mayfield Heights, OH 44124
              </p>
              <p>
                <strong>Desk hours</strong>
                <br />
                The trading desk keeps New York market hours. Messages are answered outside market
                hours too.
              </p>
            </div>
            <div style={{ marginTop: 28 }}>
              <DeskClock />
            </div>
          </Reveal>

          <Reveal as="div">
            <h2 style={{ fontSize: 22, marginBottom: 22 }}>Write to the desk</h2>
            <form onSubmit={submit} className="sgs-form">
              <label className={field}>
                <span>Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label className={field}>
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className={field}>
                <span>What would you like to discuss?</span>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Your objectives, time horizon, or anything else the desk should know."
                  required
                />
              </label>
              <p style={{ fontSize: 13, color: 'var(--sgs-muted)', maxWidth: '66ch' }}>
                Submitting opens your email client with the message addressed to the desk — nothing
                is stored on this website.
              </p>
              <button type="submit" className="sgs-btn-solid">
                Send message
              </button>
            </form>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
