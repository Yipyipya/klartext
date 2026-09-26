import "./landing.css";
import { DownloadCta, ReturningVisitor } from "./SiteClient";
import { LANDING_COPY, type SiteLanguage } from "./landing-content";
import { INSTALLERS_SIGNED, LEGAL_NOTICE_URL } from "@/shared/site";
import {
  LATEST_DOWNLOAD_BASE_URL,
  RELEASE_ASSETS,
  RELEASE_REPOSITORY_URL,
  RELEASES_PAGE_URL,
} from "@/shared/release";

const MAC_HREF = `${LATEST_DOWNLOAD_BASE_URL}/${RELEASE_ASSETS.mac}`;
const WINDOWS_HREF = `${LATEST_DOWNLOAD_BASE_URL}/${RELEASE_ASSETS.windows}`;
const CHECKSUMS_HREF = `${LATEST_DOWNLOAD_BASE_URL}/${RELEASE_ASSETS.checksums}`;
const DOCS_BASE = `${RELEASE_REPOSITORY_URL}/blob/main`;

export function SiteHeader({ lang }: { lang: SiteLanguage }) {
  const copy = LANDING_COPY[lang];
  const home = copy.path;
  return (
    <header className="site-header">
      <a className="site-skip" href="#content">{copy.nav.skip}</a>
      <div className="site-container site-header-inner">
        <a className="site-brand" href={home} aria-label="Nivune">
          <VoiceMark />
          <span>Nivune</span>
        </a>
        <nav className="site-nav" aria-label={copy.nav.main}>
          <a href={`${home === "/" ? "/" : home}#features`}>{copy.nav.features}</a>
          <a href={`${home === "/" ? "/" : home}#data`}>{copy.nav.data}</a>
          <a href={`${home === "/" ? "/" : home}#faq`}>{copy.nav.faq}</a>
        </nav>
        <div className="site-header-actions">
          <a className="site-lang" href={copy.alternatePath} hrefLang={lang === "de" ? "en" : "de"} lang={lang === "de" ? "en" : "de"}>
            {copy.alternateLabel}
          </a>
          <a className="site-button site-button-quiet" href="/app">{copy.nav.openApp}</a>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ lang }: { lang: SiteLanguage }) {
  const copy = LANDING_COPY[lang];
  return (
    <footer className="site-footer">
      <div className="site-container site-footer-inner">
        <div>
          <a className="site-brand" href={copy.path} aria-label="Nivune">
            <VoiceMark />
            <span>Nivune</span>
          </a>
          <p>{copy.footer.tagline}</p>
        </div>
        <nav aria-label="Footer">
          <a href={RELEASE_REPOSITORY_URL}>{copy.footer.source}</a>
          <a href={copy.privacyPath}>{copy.footer.privacy}</a>
          {LEGAL_NOTICE_URL && <a href={LEGAL_NOTICE_URL}>{copy.footer.legal}</a>}
          <a href={`${DOCS_BASE}/LICENSE`}>{copy.footer.license}</a>
          <a href={copy.alternatePath} hrefLang={lang === "de" ? "en" : "de"}>{copy.alternateLabel}</a>
        </nav>
      </div>
    </footer>
  );
}

export default function Landing({ lang }: { lang: SiteLanguage }) {
  const copy = LANDING_COPY[lang];
  return (
    <div className="site">
      <SiteHeader lang={lang} />
      <main id="content">
        <section className="site-hero">
          <div className="site-container site-hero-grid">
            <div className="site-hero-copy">
              <p className="site-eyebrow">{copy.hero.eyebrow}</p>
              <h1>{copy.hero.title}</h1>
              <p className="site-lead">{copy.hero.lead}</p>
              <div className="site-actions">
                <DownloadCta
                  macHref={MAC_HREF}
                  windowsHref={WINDOWS_HREF}
                  labels={{ mac: copy.hero.downloadMac, windows: copy.hero.downloadWindows, choose: copy.hero.downloadChoose }}
                />
                <a className="site-button site-button-secondary" href="/app">{copy.hero.tryWeb}</a>
              </div>
              <p className="site-platforms">{copy.hero.platforms}</p>
              <ReturningVisitor message={copy.hero.returning} action={copy.hero.returningAction} />
            </div>
            <ProductIllustration lang={lang} />
          </div>
        </section>

        <section className="site-section" id="features" aria-labelledby="features-title">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="features-title">{copy.features.title}</h2>
              <p>{copy.features.lead}</p>
            </div>
            <div className="site-features">
              {copy.features.items.map((item, index) => (
                <article key={item.title} className="site-feature">
                  <FeatureIcon index={index} />
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section site-section-tint" id="data" aria-labelledby="data-title">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="data-title">{copy.data.title}</h2>
              <p>{copy.data.lead}</p>
            </div>
            <div className="site-paths">
              <FlowCard title={copy.data.local.title} points={copy.data.local.points} kind="local" />
              <FlowCard title={copy.data.provider.title} points={copy.data.provider.points} kind="provider" />
            </div>
            <p className="site-note">{copy.data.note}</p>
          </div>
        </section>

        <section className="site-section" aria-label={`${copy.cost.title}, ${copy.openSource.title}`}>
          <div className="site-container site-two">
            <div>
              <h2>{copy.cost.title}</h2>
              <p className="site-body">{copy.cost.body}</p>
            </div>
            <div>
              <h2>{copy.openSource.title}</h2>
              <p className="site-body">{copy.openSource.body}</p>
              <ul className="site-links">
                <li><a href={RELEASE_REPOSITORY_URL}>{copy.openSource.github}</a></li>
                <li><a href={`${DOCS_BASE}/docs/SELF_HOSTING.md`}>{copy.openSource.selfHosting}</a></li>
                <li><a href={`${DOCS_BASE}/SECURITY.md`}>{copy.openSource.security}</a></li>
              </ul>
            </div>
          </div>
        </section>

        <section className="site-section site-section-tint" id="download" aria-labelledby="download-title">
          <div className="site-container site-download">
            <div>
              <h2 id="download-title">{copy.download.title}</h2>
              <p className="site-body">{copy.download.lead}</p>
              <div className="site-download-options">
                <a className="site-download-card" href={MAC_HREF}>
                  <strong>{copy.download.mac}</strong>
                  <small>{copy.download.macDetail}</small>
                </a>
                <a className="site-download-card" href={WINDOWS_HREF}>
                  <strong>{copy.download.windows}</strong>
                  <small>{copy.download.windowsDetail}</small>
                </a>
              </div>
              <p className="site-small">
                <a href={CHECKSUMS_HREF}>{copy.download.checksums}</a>
                <span aria-hidden="true"> · </span>
                <a href={RELEASES_PAGE_URL}>{copy.download.allReleases}</a>
              </p>
            </div>
            <div>
              <h3>{copy.requirements.title}</h3>
              <ul className="site-list">
                {copy.requirements.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <p className="site-note">{INSTALLERS_SIGNED ? copy.requirements.signed : copy.requirements.unsigned}</p>
            </div>
          </div>
        </section>

        <section className="site-section" id="faq" aria-labelledby="faq-title">
          <div className="site-container site-faq">
            <h2 id="faq-title">{copy.faq.title}</h2>
            <div>
              {copy.faq.items.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}

function ProductIllustration({ lang }: { lang: SiteLanguage }) {
  const demo = LANDING_COPY[lang].demo;
  return (
    <figure className="site-demo" aria-label={demo.label}>
      <div className="site-demo-stage">
      <div className="site-demo-window" aria-hidden="true">
        <div className="site-demo-bar"><i /><i /><i /><span>{demo.app}</span></div>
        <div className="site-demo-lines">
          <span className="short" />
          <span />
        </div>
        <p className="site-demo-text">{demo.text}<span className="site-demo-caret" /></p>
      </div>
      <div className="site-demo-pill" aria-hidden="true">
        <span className="site-demo-bars"><i /><i /><i /></span>
        <span className="site-demo-state">{demo.listening}</span>
        <span className="site-demo-time">0:07</span>
      </div>
      </div>
      <div className="site-demo-chips" aria-hidden="true">
        <span>{demo.audio}</span>
        <span>{demo.refinementOff}</span>
      </div>
      <figcaption>{demo.caption}</figcaption>
    </figure>
  );
}

function FlowCard({ title, points, kind }: { title: string; points: string[]; kind: "local" | "provider" }) {
  return (
    <article className="site-path" data-kind={kind}>
      <div className="site-path-head">
        {kind === "local" ? <DeviceIcon /> : <ProviderIcon />}
        <h3>{title}</h3>
      </div>
      <ul>
        {points.map((point) => <li key={point}>{point}</li>)}
      </ul>
    </article>
  );
}

export function VoiceMark() {
  return (
    <svg className="site-voice-mark" width="22" height="24" viewBox="0 0 22 24" aria-hidden="true">
      <rect x="2" y="7" width="4" height="10" rx="2" fill="currentColor" />
      <rect x="9" y="2" width="4" height="20" rx="2" fill="currentColor" />
      <rect x="16" y="9" width="4" height="6" rx="2" fill="currentColor" />
    </svg>
  );
}

function FeatureIcon({ index }: { index: number }) {
  const paths = [
    <><path d="M5 7h14M5 12h9M5 17h6" /><path d="M17 14v6M14 17h6" /></>,
    <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
    <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></>,
  ];
  return (
    <svg className="site-feature-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[index % paths.length]}
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

function ProviderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.1 4.5 4.5 0 0 0 7 18z" />
    </svg>
  );
}
