'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

type Platform = 'TradingView' | 'Exness / Indie' | 'MT5';

type Indicator = {
  id: string;
  name: string;
  subtitle: string;
  platform: Platform;
  version: string;
  file: string;
  description: string;
  tags: string[];
  status: string;
  href?: string;
  featured?: boolean;
};

const INDICATORS: Indicator[] = [
  {
    id: 'ha-overlay',
    name: 'Heikin Ashi Overlay + Trade Bridge',
    subtitle: 'Average candles on a normal chart, with TBSIG markers for the Chrome/MT5 bridge',
    platform: 'Exness / Indie',
    version: 'Indie v5',
    file: 'Heikin_Ashi_Overlay.indie.txt',
    description:
      'Draws Heikin Ashi candles as an indicator overlay so standard indicators keep working on Exness Web Terminal. On confirmed bar closes it can emit TBSIG|BUY|SYMBOL|VOLUME markers that the Chrome extension forwards to your local MT5 bridge.',
    tags: ['Heikin Ashi', 'Overlay', 'TBSIG', 'Auto-trade ready'],
    status: 'Draft — verify in your editor',
    featured: true,
  },
  {
    id: 'dark-orders',
    name: 'Dark Orders — Pure Price + History',
    subtitle: 'Price expansion overlay with a recent-signal recap table',
    platform: 'TradingView',
    version: 'Pine v5',
    file: 'Dark_Orders_Pure_Price.pine',
    description:
      'Highlights unusual range and body expansion using a 50-bar lookback. Orange marks expansion; teal/red adds a Heikin Ashi body filter. Includes an optional 20-signal history recap.',
    tags: ['Price action', 'Z-score', 'Recap'],
    status: 'Download available',
    href: '/',
  },
  {
    id: 'trend-predictor',
    name: 'Trend Predictor',
    subtitle: 'Closed-candle VWAP and volume-weighted EMA anchor',
    platform: 'TradingView',
    version: 'Pine v5',
    file: 'Trend_Predictor.pine',
    description:
      'An anchor study blending session VWAP with a volume-weighted EMA. No buy or sell signals — built for confluence with your own edge.',
    tags: ['VWAP', 'EMA', 'Anchor'],
    status: 'Download available',
    href: '/trend-predictor',
  },
  {
    id: 'two-in-one',
    name: 'Dark Orders + Trend Predictor',
    subtitle: 'Two independent studies in one saved script',
    platform: 'TradingView',
    version: 'Pine v5 / Indie v5',
    file: 'Dark_Orders_Trend_Predictor.indie.txt',
    description:
      'Combined Pine source plus a draft Indie version that reconstructs Heikin Ashi from standard OHLC. The two calculations stay independent.',
    tags: ['Combined', 'Draft Indie'],
    status: 'Draft Indie',
    href: '/two-in-one',
  },
  {
    id: 'session-range',
    name: 'My Session Range',
    subtitle: 'Developing high/low for your chosen trading session',
    platform: 'TradingView',
    version: 'Pine v6 / Indie v5',
    file: 'Blackwatch_My_Session_Range.indie.txt',
    description:
      'Highlights developing session highs and lows with optional shading. Defaults to 03:00–07:00 fixed EST and works on normal candles in Indie.',
    tags: ['Sessions', 'Range', 'EST'],
    status: 'Draft Indie',
    href: '/session-range',
  },
  {
    id: 'nq-profile',
    name: 'NQ Developing Volume Profile',
    subtitle: 'Latest developing profile from 16:00 New York time',
    platform: 'TradingView',
    version: 'Pine v6 / Indie v5',
    file: 'NQ_Developing_Volume_Profile.indie.txt',
    description:
      'Approximates a developing volume profile from chart candles. Shows POC, VAH and VAL. Uses uniform volume allocation, not true bid/ask volume.',
    tags: ['Volume profile', 'POC', 'NQ'],
    status: 'Draft Indie',
    href: '/nq-volume-profile',
  },
  {
    id: 'all-in-one',
    name: 'All In One',
    subtitle: 'Dark Orders, anchor, session range and volume profiles in one script',
    platform: 'TradingView',
    version: 'Pine v6',
    file: 'All_In_One.pine',
    description:
      'A single Basic-plan-friendly indicator with switchable study groups. Turn off the heavy profiles if the 20-second calculation limit is hit.',
    tags: ['Bundle', 'Basic plan'],
    status: 'Download available',
    href: '/all-in-one',
  },
  {
    id: 'supertrend',
    name: 'Supertrend HA MT5 tester',
    subtitle: 'Research-only M1 Heikin Ashi EA draft',
    platform: 'MT5',
    version: 'MQL5 draft',
    file: 'Supertrend_HA_Tester_Research.zip',
    description:
      'Source-only tester package with a basic dashboard and synthetic HA study levels. Tester only; not a full Pine port and not verified in MetaEditor.',
    tags: ['EA', 'Tester', 'M1'],
    status: 'Research draft',
    href: '/supertrend-tester',
  },
];

const FILTERS: Array<'All' | Platform> = ['All', 'TradingView', 'Exness / Indie', 'MT5'];

export default function IndicatorVault() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'All' | Platform>('All');
  const [active, setActive] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return INDICATORS.filter((item) => {
      const matchFilter = filter === 'All' || item.platform === filter;
      const matchQuery =
        !needle ||
        [item.name, item.subtitle, item.description, item.platform, item.version, ...item.tags]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      return matchFilter && matchQuery;
    });
  }, [query, filter]);

  async function openSource(item: Indicator) {
    setActive(item.id);
    setCode('');
    setMessage('');
    setLoading(true);
    try {
      const response = await fetch(`/ea/${item.file}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Source file not found. Ask Trading Brain to publish it.');
      const text = await response.text();
      if (text.length < 40) throw new Error('The source file appears to be empty.');
      setCode(text);
      setMessage('Source loaded. Replace all existing editor text before pasting.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load the source.');
    } finally {
      setLoading(false);
    }
  }

  async function copySource() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(code);
      setMessage('Copied. Paste into your editor, save, then add to chart.');
    } catch {
      setMessage('Clipboard blocked — select the code manually and copy it.');
    }
  }

  return (
    <main className="page vault">
      <header>
        <Link className="brand" href="/">TRADING BRAIN <span>/</span> INDICATOR VAULT</Link>
        <span className="tag">SIGNALS · DRAFTS · SOURCE</span>
      </header>

      <section className="intro vault-intro">
        <p className="eyebrow">YOUR INDICATOR LIBRARY</p>
        <h1>Indicator<span>.</span>Vault</h1>
        <p>
          Every Trading Brain study in one place. Search by name, platform or tag, download the source,
          and copy it straight into TradingView Pine Editor or the Exness Terminal Indie editor.
        </p>
        <div className="vault-stats">
          <div><strong>{INDICATORS.length}</strong><span>published studies</span></div>
          <div><strong>3</strong><span>target platforms</span></div>
          <div><strong>1</strong><span>trade bridge</span></div>
        </div>
      </section>

      <section className="vault-controls" aria-label="Filter indicators">
        <label className="vault-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Heikin Ashi, session, VWAP, MT5…"
            aria-label="Search indicators"
          />
        </label>
        <div className="vault-filters" role="group" aria-label="Platform filter">
          {FILTERS.map((name) => (
            <button
              type="button"
              key={name}
              className={filter === name ? 'chip active' : 'chip'}
              onClick={() => setFilter(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      {results.length === 0 && <p className="vault-empty">No studies match that search.</p>}

      <section className="vault-grid">
        {results.map((item) => (
          <article className={item.featured ? 'card vault-card featured' : 'card vault-card'} key={item.id}>
            <div className="vault-card-top">
              <span className="tag">{item.platform}</span>
              <span className="vault-version">{item.version}</span>
            </div>
            <h2>{item.name}</h2>
            <p className="vault-subtitle">{item.subtitle}</p>
            <p className="vault-description">{item.description}</p>
            <div className="vault-tags">
              {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
            <p className="vault-status">{item.status}</p>
            <div className="vault-actions">
              <a className="button primary" href={`/ea/${item.file}`} download>Download source</a>
              <button type="button" className="button secondary" onClick={() => void openSource(item)}>
                {loading && active === item.id ? 'Loading…' : 'View code'}
              </button>
              {item.href && <Link className="button ghost" href={item.href}>Details</Link>}
            </div>
          </article>
        ))}
      </section>

      {active && (
        <section className="card vault-code" aria-live="polite">
          <div className="card-heading">
            <div>
              <p className="eyebrow">SOURCE VIEWER</p>
              <h2>{INDICATORS.find((item) => item.id === active)?.name}</h2>
            </div>
            <button type="button" className="button secondary" onClick={() => void copySource()} disabled={!code}>
              Copy code
            </button>
          </div>
          <p>{message || 'Loading source…'}</p>
          <textarea
            aria-label="Indicator source code"
            value={code}
            readOnly
            spellCheck={false}
            onFocus={(event) => event.currentTarget.select()}
          />
        </section>
      )}

      <section className="card vault-bridge">
        <p className="eyebrow">EXNESS → CHROME → MT5</p>
        <h2>Trade Bridge</h2>
        <p>
          The Heikin Ashi Overlay can print <code>TBSIG|BUY|SYMBOL|VOLUME</code> markers on confirmed
          candles. The Chrome extension reads those markers and sends an order request to a local Python
          bridge that talks to MetaTrader 5 on your Windows machine.
        </p>
        <ol>
          <li>Install the Indie indicator from this vault and enable <strong>Emit TBSIG markers</strong>.</li>
          <li>Load the Chrome extension from <code>extension-trade-bridge/</code>.</li>
          <li>Run the local bridge from <code>mt5-bridge/</code> with your MT5 terminal logged in.</li>
          <li>Set your bridge token and symbol allowlist in the extension popup.</li>
        </ol>
        <aside>
          <strong>Real money warning.</strong> Auto-execution is disabled until you explicitly set
          <code> TB_AUTO_TRADE=1</code>, <code>TB_DRY_RUN=0</code> and <code>TB_ACKNOWLEDGE_REAL=1</code>.
          Start in dry-run mode, verify the logs, then enable live trading. Keep the kill switch handy.
          Trading Brain indicators are analysis drafts, not verified strategies and not financial advice.
        </aside>
      </section>

      <footer>TRADING BRAIN / INDICATOR VAULT <span>NOT FINANCIAL ADVICE</span></footer>
    </main>
  );
}
