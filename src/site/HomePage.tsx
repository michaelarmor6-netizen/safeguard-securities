import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DeskClock } from './fragments';
import { Reveal } from './Reveal';
import MarketStrip from './MarketStrip';

const SLIDES = [
  {
    img: '/site-assets/reflective-skyscraper-facade-unsplash.jpg',
    alt: 'A reflective glass tower reaching into the sky',
    title: 'Institutional discipline, applied.',
    body: 'Safeguard Securities helps serious investors make better decisions with clear strategy, active risk controls, and direct access to global markets.',
    cta: { label: 'Start your account', to: '/signup' },
    altCta: { label: 'Speak with the desk', to: '/contact' },
    heading: 'h1' as const,
  },
  {
    img: '/site-assets/san-francisco-ca-usa-golden-gate-bridge.jpg',
    alt: 'A suspension bridge tower rising out of the fog',
    title: 'Trade around the clock.',
    body: 'Stocks, options, ETFs, futures, bonds and digital assets — with every fill, fee and mark recorded against your ledger, not lost in a statement at month end.',
    cta: { label: 'See the platforms', to: '/services#platforms' },
    altCta: { label: 'Explore strategies', to: '/services#strategies' },
    heading: 'h2' as const,
  },
  {
    img: '/site-assets/sunlight-on-the-curved-honeycomb-glass-facade.jpg',
    alt: 'Sunlight on the curved honeycomb glass facade of a tower',
    title: 'Prices posted by our desk.',
    body: 'Every instrument you hold carries a desk-posted mark, dated the day it was set. Your portfolio is valued from the same record the desk trades against.',
    cta: { label: 'Why Safeguard', to: '/about' },
    altCta: { label: 'Open an account', to: '/signup' },
    heading: 'h2' as const,
  },
];

const PROPS = [
  {
    title: 'Desk-posted pricing',
    body: 'Marks are posted by our trading desk for every instrument you hold — dated, auditable, and free of aggregator noise.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M3 17l5-5 4 3 6-7 3 3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 21h18" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Global market access',
    body: 'Trade across 40+ venues with deep liquidity, transparent pricing and execution quality designed for active portfolios.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.7 3.8 5.8 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.8-3.8-9S9.5 5.7 12 3z" />
      </svg>
    ),
  },
  {
    title: 'AI Strategy Engine',
    body: 'Our proprietary engine synthesises quantitative models and alternative data into risk-adjusted allocations, monitored continuously.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="5" y="7" width="14" height="12" rx="2" />
        <path d="M12 7V4M9 12h.01M15 12h.01M9.5 16h5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Preservation first',
    body: 'The process starts with capital preservation, then compounds through disciplined execution and position-level risk limits.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const PLATFORM_TILES = [
  {
    title: 'Investor Workspace',
    body: 'Your dashboard, holdings, wallet and performance history in one browser workspace — live marks and desk-posted P/L included.',
    to: '/login',
    cta: 'Client login',
  },
  {
    title: 'Trade Desk',
    body: 'Direct desk execution with a fill ledger you can read: every trade carries its reference, price and fees.',
    to: '/contact',
    cta: 'Talk to the desk',
  },
  {
    title: 'AI Engine insights',
    body: 'Watch the strategy engine work: signals, allocations and risk posture explained in plain language.',
    to: '/services#platforms',
    cta: 'Learn more',
  },
  {
    title: 'Statements & reporting',
    body: 'Account statements generated on demand, exportable and printable — the same ledger the desk trades against.',
    to: '/services#services',
    cta: 'See reporting',
  },
];

const STRATEGIES = [
  ['Equities', 'core & tactical'],
  ['Multi-Asset', 'blended allocation'],
  ['Real Estate', 'sector exposure'],
  ['Healthcare', 'defensive growth'],
  ['Infrastructure', 'income & stability'],
  ['Top Dividend', 'yield focus'],
  ['Consumer Discretionary', 'cyclical'],
  ['Tech Giants', 'large-cap growth'],
  ['Energy & Utilities', 'value & income'],
];

export default function HomePage() {
  const [slide, setSlide] = useState(0);

  // Slides change on the dots only: an auto-advancing hero moves while people
  // read, and it broke measurement. Dots remain the interaction.
  return (
    <main>
      {/* hero carousel */}
      <section className="sgs-hero" aria-label="Highlights">
        {SLIDES.map((s, i) => {
          const Tag = s.heading;
          return (
            <div className="sgs-slide" data-active={String(i === slide)} key={s.title}>
              <img className="sgs-slide-img" src={s.img} alt={s.alt} />
              <div className="sgs-wrap">
                <div className="sgs-slide-content">
                  <Tag>{s.title}</Tag>
                  <p>{s.body}</p>
                  <div className="sgs-slide-cta">
                    <Link to={s.cta.to} className="sgs-btn-gold">
                      {s.cta.label}
                    </Link>
                    <Link to={s.altCta.to} className="sgs-quiet">
                      {s.altCta.label}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div className="sgs-dots">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              className="sgs-dot"
              aria-current={i === slide}
              aria-label={`Slide ${i + 1}: ${s.title}`}
              onClick={() => setSlide(i)}
            />
          ))}
        </div>
      </section>

      {/* live desk marks */}
      <MarketStrip />

      {/* value props */}
      <section className="sgs-section">
        <div className="sgs-wrap">
          <Reveal className="sgs-eyebrow-row" as="div">
            <h2>A brokerage built for clarity</h2>
          </Reveal>
          <div className="sgs-props">
            {PROPS.map((p) => (
              <Reveal className="sgs-prop" key={p.title} as="div">
                <div className="sgs-prop-icon">{p.icon}</div>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* stats band */}
      <section className="sgs-stats-band">
        <div className="sgs-wrap">
          <Reveal as="div">
            <h2>Discover a world of opportunities</h2>
            <p className="sgs-band-sub">
              Invest globally in stocks, options, futures, bonds, funds and digital assets from a
              single unified account — funded by wire, recorded on a ledger, marked by the desk.
            </p>
          </Reveal>
          <div className="sgs-band-stats">
            <Reveal className="sgs-band-stat" as="div">
              <strong>40+</strong>
              <span>global markets and venues</span>
            </Reveal>
            <Reveal className="sgs-band-stat" as="div">
              <strong>9</strong>
              <span>sector strategies in one account</span>
            </Reveal>
            <Reveal className="sgs-band-stat" as="div">
              <strong>24/7</strong>
              <span>autonomous engine monitoring</span>
            </Reveal>
          </div>
        </div>
      </section>

      {/* platform tiles */}
      <section className="sgs-section" id="platforms-home">
        <div className="sgs-wrap">
          <Reveal className="sgs-eyebrow-row" as="div">
            <h2>Powerful platforms to help you succeed</h2>
            <Link className="sgs-more" to="/services#platforms">
              Compare platforms →
            </Link>
          </Reveal>
          <div className="sgs-tiles">
            {PLATFORM_TILES.map((t) => (
              <Reveal className="sgs-tile" key={t.title} as="div">
                <h3>{t.title}</h3>
                <p>{t.body}</p>
                <Link to={t.to}>{t.cta}</Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* testimonial band */}
      <section className="sgs-section sgs-quote-band">
        <div className="sgs-wrap">
          <Reveal as="div">
            <figure style={{ margin: 0 }}>
              <blockquote>
                <p>
                  “The research is concise, the execution is reliable, and communication is clear.
                  They operate with true institutional standards.”
                </p>
              </blockquote>
              <figcaption>
                <strong>Catherine Hargrove</strong> · Chief Investment Officer, Meridian Wealth
                Advisors
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* trust */}
      <section className="sgs-section">
        <div className="sgs-wrap sgs-trust">
          <Reveal as="div">
            <h2>A broker you can audit</h2>
            <div className="sgs-trust-copy">
              <p>
                <strong>Every position, marked.</strong> The desk posts prices for each instrument
                you hold; your portfolio is valued from that record, dated the day it was set.
              </p>
              <p>
                <strong>Every trade, receipted.</strong> Fills carry a reference, a price and their
                fees. Statements are generated from the same ledger the desk trades against.
              </p>
              <p>
                <strong>Every day, monitored.</strong> The AI engine watches order flow, sentiment
                and macro indicators continuously, with position-level risk limits on every
                strategy.
              </p>
              <p style={{ fontSize: 13, color: 'var(--sgs-muted)', maxWidth: '66ch' }}>
                Regulatory registration, disclosures and forms are available on request from the
                desk. All forms of investment carry risk, including possible loss of principal. Past
                performance is no guide to future performance.
              </p>
            </div>
          </Reveal>
          <Reveal as="div">
            <div className="sgs-trust-photo">
              <img
                src="/site-assets/sunlight-on-the-curved-honeycomb-glass-facade.jpg"
                alt="Sunlight on the curved honeycomb glass facade of a tower"
                loading="lazy"
                decoding="async"
              />
              <div className="sgs-trust-stats">
                <div>
                  <strong>10,000+</strong>
                  <span>data points / second</span>
                </div>
                <div>
                  <strong>&lt;50ms</strong>
                  <span>execution latency</span>
                </div>
                <div>
                  <strong>40+</strong>
                  <span>global markets</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* strategies */}
      <section className="sgs-section sgs-section-alt" id="strategies-home">
        <div className="sgs-wrap">
          <Reveal className="sgs-eyebrow-row" as="div">
            <h2>Building your wealth across sectors</h2>
            <Link className="sgs-more" to="/services#strategies">
              Explore strategies →
            </Link>
          </Reveal>
          <div className="sgs-strategies">
            {STRATEGIES.map(([name, kind]) => (
              <Link className="sgs-strategy" to="/services#strategies" key={name}>
                {name}
                <span>{kind}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* steps */}
      <section className="sgs-section">
        <div className="sgs-wrap">
          <Reveal className="sgs-eyebrow-row" as="div">
            <h2>Choose the account that fits. Open it in minutes.</h2>
          </Reveal>
          <div className="sgs-steps">
            <Reveal className="sgs-step" as="div">
              <h3>Complete the application</h3>
              <p>
                Tell us who you are and how you invest. It takes a few minutes, and the desk reviews
                every application personally.
              </p>
            </Reveal>
            <Reveal className="sgs-step" as="div">
              <h3>Fund your wallet</h3>
              <p>
                Wire into your Safeguard wallet. The funding desk credits your ledger and issues a
                receipt for every deposit.
              </p>
            </Reveal>
            <Reveal className="sgs-step" as="div">
              <h3>Get started trading</h3>
              <p>
                Watch the desk work in your workspace: holdings, marks, fills and statements, all in
                one place.
              </p>
            </Reveal>
          </div>
          <div style={{ marginTop: 36 }}>
            <Link to="/signup" className="sgs-btn-solid">
              Open account
            </Link>
          </div>
        </div>
      </section>

      {/* live band — the desk clock, like the exchange open/closed pattern */}
      <section className="sgs-live-band">
        <div className="sgs-wrap sgs-live-inner">
          <Reveal className="sgs-live-copy" as="div">
            <h2>The desk keeps market hours. Your records keep working.</h2>
            <p>
              Desk time is New York time — the same clock your positions settle on. Outside market
              hours, the desk answers messages and your ledger stays open.
            </p>
          </Reveal>
          <DeskClock />
        </div>
      </section>
    </main>
  );
}
