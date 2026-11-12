import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import './siteTheme.css';

/* ------------------------------------------------------------------ menu data */

interface MegaCol {
  title: string;
  items: { label: string; to: string; sub?: string }[];
}

interface NavItem {
  label: string;
  cols: MegaCol[];
  cta?: { line: string; to: string; btn: string };
}

const NAV: NavItem[] = [
  {
    label: 'Why Safeguard',
    cols: [
      {
        title: 'The firm',
        items: [
          { label: 'Why choose Safeguard', to: '/about', sub: 'Institutional discipline for serious investors' },
          { label: 'How we invest', to: '/about#investing', sub: 'Preservation first, then compounding' },
          { label: 'Our team', to: '/team', sub: 'The desks behind your account' },
          { label: 'Contact the desk', to: '/contact', sub: 'Speak with an investment strategist' },
        ],
      },
      {
        title: 'Standards',
        items: [
          { label: 'Desk-posted marks', to: '/about#standards', sub: 'Prices posted by our desk, not scraped' },
          { label: 'Statements on demand', to: '/about#standards', sub: 'Every fill, every mark, documented' },
          { label: 'Risk controls', to: '/services', sub: 'Position-level limits on every strategy' },
        ],
      },
    ],
    cta: { line: 'Institutional discipline, applied to your account.', to: '/signup', btn: 'Open an account' },
  },
  {
    label: 'Products',
    cols: [
      {
        title: 'Trade & invest',
        items: [
          { label: 'Stocks', to: '/services#instruments' },
          { label: 'Options', to: '/services#instruments' },
          { label: 'ETFs', to: '/services#instruments' },
          { label: 'Bonds', to: '/services#instruments' },
          { label: 'Futures', to: '/services#instruments' },
          { label: 'Cryptocurrency', to: '/services#instruments' },
          { label: 'IPOs', to: '/services#instruments' },
          { label: 'M&A', to: '/services#instruments' },
        ],
      },
      {
        title: 'Sector strategies',
        items: [
          { label: 'Equities & Multi-Asset', to: '/services#strategies' },
          { label: 'Tech Giants & Consumer', to: '/services#strategies' },
          { label: 'Healthcare & Infrastructure', to: '/services#strategies' },
          { label: 'Energy & Utilities', to: '/services#strategies' },
          { label: 'Top Dividend & Real Estate', to: '/services#strategies' },
        ],
      },
    ],
    cta: { line: 'Nine sector strategies, one account.', to: '/services', btn: 'Explore strategies' },
  },
  {
    label: 'Platforms',
    cols: [
      {
        title: 'Client platforms',
        items: [
          { label: 'Investor Workspace', to: '/services#platforms', sub: 'Browser-based dashboard and portfolio' },
          { label: 'Trade Desk', to: '/services#platforms', sub: 'Direct desk execution and fill ledger' },
          { label: 'AI Engine insights', to: '/services#platforms', sub: 'The strategy engine behind allocations' },
          { label: 'Mobile access', to: '/services#platforms', sub: 'Installable app for iOS and Android' },
        ],
      },
      {
        title: 'Account services',
        items: [
          { label: 'Wallet & funding', to: '/services#services', sub: 'Wire funding with ledger receipts' },
          { label: 'Statements & reporting', to: '/services#services', sub: 'On-demand and monthly records' },
          { label: 'Research & news', to: '/services#services', sub: 'Decision-ready desk research' },
        ],
      },
    ],
    cta: { line: 'One platform, every record.', to: '/login', btn: 'Client login' },
  },
  {
    label: 'Pricing',
    cols: [
      {
        title: 'Commissions & fees',
        items: [
          { label: 'Fee schedule', to: '/contact', sub: 'Request the current schedule from the desk' },
          { label: 'Funding & withdrawals', to: '/services#services', sub: 'How money moves in and out' },
        ],
      },
      {
        title: 'Transparency',
        items: [
          { label: 'No hidden spreads', to: '/about#standards', sub: 'Desk-posted marks you can audit' },
          { label: 'Statements & ledger', to: '/about#standards', sub: 'Your account, documented line by line' },
        ],
      },
    ],
    cta: { line: 'Talk to the desk about pricing for your volume.', to: '/contact', btn: 'Contact us' },
  },
  {
    label: 'Support',
    cols: [
      {
        title: 'Clients',
        items: [
          { label: 'Client support', to: '/contact', sub: 'Tickets answered by the desk' },
          { label: 'Fund your account', to: '/services#services', sub: 'Wire instructions and receipts' },
          { label: 'Client login', to: '/login', sub: 'Your workspace and records' },
        ],
      },
      {
        title: 'New investors',
        items: [
          { label: 'Open an account', to: '/signup', sub: 'Apply in a few minutes' },
          { label: 'Book a strategy call', to: '/contact', sub: 'Map a plan with an advisor' },
        ],
      },
    ],
    cta: { line: 'Questions before you apply? Ask the desk.', to: '/contact', btn: 'Ask a question' },
  },
];

const FOOTER_COLS: { title: string; items: { label: string; to: string; external?: boolean }[] }[] = [
  {
    title: 'Account',
    items: [
      { label: 'Client login', to: '/login' },
      { label: 'Open an account', to: '/signup' },
      { label: 'Book a strategy call', to: '/contact' },
      { label: 'Fund your account', to: '/services#services' },
    ],
  },
  {
    title: 'Products',
    items: [
      { label: 'Sector strategies', to: '/services#strategies' },
      { label: 'Instruments', to: '/services#instruments' },
      { label: 'Platforms', to: '/services#platforms' },
      { label: 'Fee schedule', to: '/contact' },
    ],
  },
  {
    title: 'Company',
    items: [
      { label: 'About us', to: '/about' },
      { label: 'Our team', to: '/team' },
      { label: 'Contact', to: '/contact' },
      { label: 'safeguardsecurities.us', to: 'https://safeguardsecurities.us', external: true },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'Client support', to: '/contact' },
      { label: 'support@safeguardsecurities.us', to: 'mailto:support@safeguardsecurities.us' },
      { label: '+1 937 982 1491', to: 'tel:+19379821491' },
    ],
  },
];

/* ------------------------------------------------------------------- layout */

export default function SiteLayout() {
  const { pathname, hash } = useLocation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
    if (hash) {
      // let the page paint, then honour the deep link
      requestAnimationFrame(() => {
        document.querySelector(hash)?.scrollIntoView({ block: 'start' });
      });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return (
    <div className="sg-site" id="top">
      <div className="sgs-announce">
        <div className="sgs-wrap">
          <span>Desk-posted marks, statements on demand, and a wallet ledger you can audit.</span>
          <Link to="/signup">Open an account</Link>
        </div>
      </div>

      <header className="sgs-header" onMouseLeave={() => setOpenMenu(null)}>
        <div className="sgs-wrap sgs-header-inner">
          <Link to="/" className="sgs-wordmark">
            Safeguard Securities
          </Link>
          <nav className="sgs-nav" aria-label="Primary">
            {NAV.map((n) => (
              <div className="sgs-nav-item" key={n.label}>
                <button
                  type="button"
                  className="sgs-nav-btn"
                  aria-expanded={openMenu === n.label}
                  onClick={() => setOpenMenu(openMenu === n.label ? null : n.label)}
                  onMouseEnter={() => setOpenMenu(n.label)}
                >
                  {n.label}
                  <svg viewBox="0 0 10 6" aria-hidden="true">
                    <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
              </div>
            ))}
          </nav>
          <div className="sgs-header-actions">
            <Link to="/login" className="sgs-btn-ghost">
              Log In
            </Link>
            <Link to="/signup" className="sgs-btn-solid">
              Open Account
            </Link>
            <button
              type="button"
              className="sgs-menu-btn"
              aria-expanded={mobileOpen}
              aria-controls="sgs-mobile-nav"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? 'Close' : 'Menu'}
            </button>
          </div>
        </div>

        {openMenu && (
          <div className="sgs-mega" onMouseLeave={() => setOpenMenu(null)}>
            <div className="sgs-mega-inner">
              {NAV.find((n) => n.label === openMenu)?.cols.map((col) => (
                <div key={col.title}>
                  <h3>{col.title}</h3>
                  <ul>
                    {col.items.map((it) => (
                      <li key={it.label}>
                        <Link to={it.to}>
                          {it.label}
                          {it.sub && <span>{it.sub}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {NAV.find((n) => n.label === openMenu)?.cta && (
                <div className="sgs-mega-cta">
                  <p>{NAV.find((n) => n.label === openMenu)!.cta!.line}</p>
                  <Link to={NAV.find((n) => n.label === openMenu)!.cta!.to} className="sgs-btn-gold">
                    {NAV.find((n) => n.label === openMenu)!.cta!.btn}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {mobileOpen && (
          <nav className="sgs-mobile-nav" id="sgs-mobile-nav" aria-label="Primary">
            {NAV.map((n) => (
              <Link key={n.label} to={n.cols[0].items[0].to}>
                {n.label}
              </Link>
            ))}
            <Link to="/login" className="sgs-mobile-login">
              Log In
            </Link>
          </nav>
        )}
      </header>

      <Outlet />

      <footer className="sgs-footer">
        <div className="sgs-wrap">
          <div className="sgs-footer-grid">
            <div className="sgs-footer-brand">
              <Link to="/" className="sgs-wordmark">
                Safeguard Securities
              </Link>
              <p>
                Institutional investment and brokerage for serious investors: clear strategy, active
                risk controls, and direct access to global markets.
              </p>
              <div className="sgs-footer-contact">
                <a href="tel:+19379821491">+1 937 982 1491</a>
                <a href="mailto:support@safeguardsecurities.us">support@safeguardsecurities.us</a>
                <span>
                  6060 Parkland Boulevard, Suite 200,
                  <br />
                  Mayfield Heights, OH 44124
                </span>
              </div>
            </div>
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <h3>{col.title}</h3>
                <ul>
                  {col.items.map((it) => (
                    <li key={it.label}>
                      {it.external ? (
                        <a href={it.to} rel="noopener noreferrer">
                          {it.label}
                        </a>
                      ) : (
                        <Link to={it.to}>{it.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="sgs-footer-legal">
            <span>© 2026 Safeguard Securities, Inc. All rights reserved.</span>
            <span>
              <a href="https://safeguardsecurities.us" rel="noopener noreferrer">
                Terms &amp; disclosures
              </a>
              {' · '}
              <Link to="/contact">Contact</Link>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
