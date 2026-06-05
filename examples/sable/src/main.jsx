import React, { useMemo } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import {
  CmsCollectionsProvider,
  CmsContentProvider,
  CmsImage,
  CmsPagesProvider,
  CmsText,
  useCmsCollection,
  useEditBridge,
} from "../../shared/useCmsPage.jsx?cmsPagesProvider";
import "./style.css";

const IconDraft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const IconReview = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const IconAudit = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const FEATURES = [
  {
    icon: <IconDraft />,
    n: "01",
    title: "Draft in minutes",
    desc: "Generate contracts from pre-approved clause libraries. No blank pages, no missed terms.",
    field: "features.1",
  },
  {
    icon: <IconReview />,
    n: "02",
    title: "AI-powered review",
    desc: "Flag risky clauses, surface missing terms, and suggest alternatives before you sign.",
    field: "features.2",
  },
  {
    icon: <IconAudit />,
    n: "03",
    title: "Full audit trail",
    desc: "Every edit, approval, and signature is logged, timestamped, and legally defensible.",
    field: "features.3",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Upload or start fresh",
    desc: "Paste an existing contract or generate a new one from your approved clause library.",
    field: "steps.1",
  },
  {
    n: "02",
    title: "Review and negotiate",
    desc: "Sable flags risk, suggests redlines, and tracks every change across all parties.",
    field: "steps.2",
  },
  {
    n: "03",
    title: "Sign and archive",
    desc: "Collect signatures and store executed contracts in a searchable, auditable repository.",
    field: "steps.3",
  },
];

const PROJECT_SLUG = "project-b";
const PAGES = [
  { slug: "home", title: "Home", path: "/" },
  { slug: "customers", title: "Customers", path: "/customers" },
];
const convexUrl = import.meta.env.VITE_CONVEX_URL;

function currentPage() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return PAGES.find((page) => page.path === path) ?? PAGES[0];
}

// Collection definition registered with the CMS editor. The website owns this
// shape; the editor reads it to build the rail row and the record form.
const CASE_STUDIES_COLLECTION = {
  key: "caseStudies",
  label: "Case studies",
  titlePath: "title",
  slugPath: "slug",
  defaultItem: {
    title: "",
    client: "",
    industry: "SaaS",
    summary: "",
    cover: "/images/sable-contract-workspace.png",
    featured: false,
  },
  fields: [
    { path: "title", label: "Title", type: "text" },
    { path: "client", label: "Client", type: "text" },
    {
      path: "industry",
      label: "Industry",
      type: "select",
      options: ["SaaS", "Finance", "Healthcare", "Retail"],
    },
    { path: "summary", label: "Summary", type: "longText" },
    { path: "cover", label: "Cover image", type: "image" },
    { path: "featured", label: "Featured on homepage", type: "boolean" },
  ],
};

function SiteApp() {
  if (!convexUrl) {
    throw new Error("Set VITE_CONVEX_URL to render CMS content from Convex.");
  }

  const convex = new ConvexReactClient(convexUrl);
  return (
    <ConvexProvider client={convex}>
      <SiteWithCms />
    </ConvexProvider>
  );
}

function SiteWithCms() {
  const page = currentPage();
  return (
    <CmsPagesProvider pages={PAGES}>
      <CmsContentProvider projectSlug={PROJECT_SLUG} pageSlug={page.slug}>
        <Site pageSlug={page.slug} />
      </CmsContentProvider>
    </CmsPagesProvider>
  );
}

function Site({ pageSlug }) {
  useEditBridge();
  const caseStudies = useCmsCollection(PROJECT_SLUG, "caseStudies");
  const collections = useMemo(
    () => [{ ...CASE_STUDIES_COLLECTION, recordCount: caseStudies.length }],
    [caseStudies.length],
  );

  return (
    <CmsCollectionsProvider collections={collections}>
      {pageSlug === "customers" ? (
        <CustomersPage caseStudies={caseStudies} />
      ) : (
        <HomePage caseStudies={caseStudies} />
      )}
    </CmsCollectionsProvider>
  );
}

function HomePage({ caseStudies }) {
  return (
    <>
      <nav className="nav" data-cms-field="nav">
        <div className="nav-inner">
          <a href="/" className="nav-brand">
            <span data-cms-field="nav.brandName">
              <CmsText fieldId="nav.brandName">Sable</CmsText>
            </span>
            <span>.</span>
          </a>
          <div className="nav-links">
            <a href="#features" data-cms-field="nav.features">
              <CmsText fieldId="nav.features">Platform</CmsText>
            </a>
            <a href="#how-it-works" data-cms-field="nav.howItWorks">
              <CmsText fieldId="nav.howItWorks">How it works</CmsText>
            </a>
            <a href="/customers" data-cms-field="nav.customers">
              <CmsText fieldId="nav.customers">Customers</CmsText>
            </a>
            <a href="#" data-cms-field="nav.login">
              <CmsText fieldId="nav.login">Sign in</CmsText>
            </a>
            <a href="#" className="nav-cta" data-cms-field="nav.cta">
              <CmsText fieldId="nav.cta">Request a demo</CmsText>
            </a>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="hero-eyebrow" data-cms-field="hero.eyebrow">
              <CmsText fieldId="hero.eyebrow">Contract lifecycle management</CmsText>
            </span>
            <h1>
              <span data-cms-field="hero.title.prefix">
                <CmsText fieldId="hero.title.prefix">Every contract,</CmsText>
              </span>
              <br />
              <em data-cms-field="hero.title.emphasis">
                <CmsText fieldId="hero.title.emphasis">controlled.</CmsText>
              </em>
            </h1>
            <p className="hero-sub" data-cms-field="hero.subtitle">
              <CmsText fieldId="hero.subtitle">
                Sable automates contract drafting, review, and approval so your legal team spends time on strategy — not paperwork.
              </CmsText>
            </p>
            <div className="hero-actions">
              <a href="#" className="btn-gold" data-cms-field="hero.cta">
                <CmsText fieldId="hero.cta">Request a demo</CmsText>
              </a>
              <a href="#features" className="btn-outline" data-cms-field="hero.cta-secondary">
                <CmsText fieldId="hero.cta-secondary">Explore the platform</CmsText>
              </a>
            </div>
          </div>
          <figure className="hero-visual">
            <CmsImage
              fieldId="hero.image"
              src="/images/sable-contract-workspace.png"
              alt="Contract review workspace"
            />
          </figure>
        </div>
        <div className="hero-rule" aria-hidden="true" />
      </section>

      <section className="stats">
        <div className="stats-inner">
          <div className="stat">
            <span className="stat-number" data-cms-field="stats.1.number">
              <CmsText fieldId="stats.1.number">340+</CmsText>
            </span>
            <span className="stat-label" data-cms-field="stats.1.label">
              <CmsText fieldId="stats.1.label">legal teams worldwide</CmsText>
            </span>
          </div>
          <div className="stat-sep" />
          <div className="stat">
            <span className="stat-number" data-cms-field="stats.2.number">
              <CmsText fieldId="stats.2.number">72%</CmsText>
            </span>
            <span className="stat-label" data-cms-field="stats.2.label">
              <CmsText fieldId="stats.2.label">faster contract cycles</CmsText>
            </span>
          </div>
          <div className="stat-sep" />
          <div className="stat">
            <span className="stat-number" data-cms-field="stats.3.number">
              <CmsText fieldId="stats.3.number">99.8%</CmsText>
            </span>
            <span className="stat-label" data-cms-field="stats.3.label">
              <CmsText fieldId="stats.3.label">clause accuracy rate</CmsText>
            </span>
          </div>
          <div className="stat-sep" />
          <div className="stat">
            <span className="stat-number" data-cms-field="stats.4.number">
              <CmsText fieldId="stats.4.number">SOC 2</CmsText>
            </span>
            <span className="stat-label" data-cms-field="stats.4.label">
              <CmsText fieldId="stats.4.label">type II certified</CmsText>
            </span>
          </div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="features-inner">
          <div className="features-header">
            <div>
              <p className="section-label" data-cms-field="features.label">
                <CmsText fieldId="features.label">The platform</CmsText>
              </p>
              <h2 className="features-title" data-cms-field="features.title">
                <CmsText fieldId="features.title">Counsel-grade automation for every contract.</CmsText>
              </h2>
            </div>
            <p className="features-aside" data-cms-field="features.aside">
              <CmsText fieldId="features.aside">
                From first draft to final signature — Sable keeps your legal team in control without slowing your business down.
              </CmsText>
            </p>
          </div>
          <div className="features-grid">
            {FEATURES.map((f) => (
              <div className="feature-card" key={f.n} data-cms-field={f.field}>
                <div className="feature-icon">{f.icon}</div>
                <p className="feature-n">{f.n}</p>
                <h3 className="feature-title" data-cms-field={`${f.field}.title`}>
                  <CmsText fieldId={`${f.field}.title`}>{f.title}</CmsText>
                </h3>
                <p className="feature-desc" data-cms-field={`${f.field}.desc`}>
                  <CmsText fieldId={`${f.field}.desc`}>{f.desc}</CmsText>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="how" id="how-it-works">
        <div className="how-inner">
          <div className="how-header">
            <p className="section-label" data-cms-field="how.label">
              <CmsText fieldId="how.label">How it works</CmsText>
            </p>
            <h2 className="how-title" data-cms-field="how.title">
              <CmsText fieldId="how.title">From blank page to executed agreement.</CmsText>
            </h2>
          </div>
          <div className="steps">
            {STEPS.map((s) => (
              <div className="step" key={s.n} data-cms-field={s.field}>
                <div className="step-num">{s.n}</div>
                <h3 className="step-title" data-cms-field={`${s.field}.title`}>
                  <CmsText fieldId={`${s.field}.title`}>{s.title}</CmsText>
                </h3>
                <p className="step-desc" data-cms-field={`${s.field}.desc`}>
                  <CmsText fieldId={`${s.field}.desc`}>{s.desc}</CmsText>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {caseStudies.length > 0 && (
        <section className="cases" id="cases">
          <div className="cases-inner">
            <div className="cases-header">
              <p className="section-label">Case studies</p>
              <h2 className="cases-title">Outcomes our customers can measure.</h2>
            </div>
            <div className="cases-grid">
              {caseStudies.map((record) => (
                <article
                  className="case-card"
                  key={record.slug}
                  data-cms-record={`caseStudies:${record.slug}`}
                >
                  <div className="case-cover">
                    <img src={record.data.cover} alt="" />
                  </div>
                  <span className="case-industry">{record.data.industry}</span>
                  <h3 className="case-title">{record.data.title}</h3>
                  <p className="case-client">{record.data.client}</p>
                  <p className="case-summary">{record.data.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="testimonial">
        <div className="testimonial-inner">
          <h2 className="testimonial-lede" data-cms-field="testimonial.lede">
            <CmsText fieldId="testimonial.lede">Trusted by in-house legal teams.</CmsText>
          </h2>
          <div className="testimonial-body">
            <p className="testimonial-quote" data-cms-field="testimonial.quote">
              <CmsText fieldId="testimonial.quote">
                We closed a 47-page supply agreement in two days. The same contract used to take three weeks of redlines over email. Sable changed our standard of practice.
              </CmsText>
            </p>
            <span className="testimonial-name" data-cms-field="testimonial.name">
              <CmsText fieldId="testimonial.name">Diana Osei</CmsText>
            </span>
            <span className="testimonial-role" data-cms-field="testimonial.role">
              <CmsText fieldId="testimonial.role">General Counsel, Northgate Group</CmsText>
            </span>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="cta-band-inner">
          <div className="cta-band-rule" aria-hidden="true" />
          <h2 data-cms-field="cta.title">
            <CmsText fieldId="cta.title">Ready to close faster?</CmsText>
          </h2>
          <p data-cms-field="cta.subtitle">
            <CmsText fieldId="cta.subtitle">
              See how Sable fits your legal workflow in a 30-minute live demo.
            </CmsText>
          </p>
          <div className="cta-band-actions">
            <a href="#" className="btn-gold" data-cms-field="cta.primary">
              <CmsText fieldId="cta.primary">Request a demo</CmsText>
            </a>
            <a href="#" className="btn-outline" data-cms-field="cta.secondary">
              <CmsText fieldId="cta.secondary">View pricing</CmsText>
            </a>
          </div>
          <span className="cta-band-note" data-cms-field="cta.note">
            <CmsText fieldId="cta.note">No commitment required · Setup in under a day</CmsText>
          </span>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-brand">
            <span data-cms-field="footer.brandName">
              <CmsText fieldId="footer.brandName">Sable</CmsText>
            </span>
            <span>.</span>
          </span>
          <div className="footer-links">
            <a href="#" data-cms-field="footer.link.1">
              <CmsText fieldId="footer.link.1">Platform</CmsText>
            </a>
            <a href="#" data-cms-field="footer.link.2">
              <CmsText fieldId="footer.link.2">Pricing</CmsText>
            </a>
            <a href="#" data-cms-field="footer.link.3">
              <CmsText fieldId="footer.link.3">Security</CmsText>
            </a>
            <a href="#" data-cms-field="footer.link.4">
              <CmsText fieldId="footer.link.4">Privacy</CmsText>
            </a>
          </div>
          <p className="footer-copy" data-cms-field="footer.copy">
            <CmsText fieldId="footer.copy">© 2026 Sable Legal Technologies. All rights reserved.</CmsText>
          </p>
        </div>
      </footer>
    </>
  );
}

function CustomersPage({ caseStudies }) {
  return (
    <>
      <nav className="nav" data-cms-field="customers.nav">
        <div className="nav-inner">
          <a href="/" className="nav-brand">
            <span data-cms-field="customers.nav.brandName">
              <CmsText fieldId="customers.nav.brandName">Sable</CmsText>
            </span>
            <span>.</span>
          </a>
          <div className="nav-links">
            <a href="/" data-cms-field="customers.nav.home">
              <CmsText fieldId="customers.nav.home">Platform</CmsText>
            </a>
            <a href="/customers" data-cms-field="customers.nav.customers">
              <CmsText fieldId="customers.nav.customers">Customers</CmsText>
            </a>
            <a href="#" className="nav-cta" data-cms-field="customers.nav.cta">
              <CmsText fieldId="customers.nav.cta">Request a demo</CmsText>
            </a>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="hero-eyebrow" data-cms-field="customers.hero.eyebrow">
              <CmsText fieldId="customers.hero.eyebrow">Customer stories</CmsText>
            </span>
            <h1 data-cms-field="customers.hero.title">
              <CmsText fieldId="customers.hero.title">
                Legal teams use Sable to close cleaner contracts faster.
              </CmsText>
            </h1>
            <p className="hero-sub" data-cms-field="customers.hero.subtitle">
              <CmsText fieldId="customers.hero.subtitle">
                See how finance, healthcare, and retail teams standardize contract work without slowing revenue.
              </CmsText>
            </p>
            <div className="hero-actions">
              <a href="#cases" className="btn-gold" data-cms-field="customers.hero.cta">
                <CmsText fieldId="customers.hero.cta">Read stories</CmsText>
              </a>
              <a href="/" className="btn-outline" data-cms-field="customers.hero.secondary">
                <CmsText fieldId="customers.hero.secondary">Back to platform</CmsText>
              </a>
            </div>
          </div>
          <figure className="hero-visual">
            <CmsImage
              fieldId="customers.hero.image"
              src="/images/sable-contract-workspace.png"
              alt="Contract analytics workspace"
            />
          </figure>
        </div>
        <div className="hero-rule" aria-hidden="true" />
      </section>

      <section className="cases" id="cases">
        <div className="cases-inner">
          <div className="cases-header">
            <p className="section-label" data-cms-field="customers.cases.label">
              <CmsText fieldId="customers.cases.label">Outcomes</CmsText>
            </p>
            <h2 className="cases-title" data-cms-field="customers.cases.title">
              <CmsText fieldId="customers.cases.title">Measurable wins from real contract teams.</CmsText>
            </h2>
          </div>
          <div className="cases-grid">
            {caseStudies.map((record) => (
              <article
                className="case-card"
                key={record.slug}
                data-cms-record={`caseStudies:${record.slug}`}
              >
                <div className="case-cover">
                  <img src={record.data.cover} alt="" />
                </div>
                <span className="case-industry">{record.data.industry}</span>
                <h3 className="case-title">{record.data.title}</h3>
                <p className="case-client">{record.data.client}</p>
                <p className="case-summary">{record.data.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="cta-band-inner">
          <div className="cta-band-rule" aria-hidden="true" />
          <h2 data-cms-field="customers.cta.title">
            <CmsText fieldId="customers.cta.title">Want the same contract velocity?</CmsText>
          </h2>
          <p data-cms-field="customers.cta.subtitle">
            <CmsText fieldId="customers.cta.subtitle">
              We will map your current contract workflow and show where Sable removes delay.
            </CmsText>
          </p>
          <div className="cta-band-actions">
            <a href="#" className="btn-gold" data-cms-field="customers.cta.primary">
              <CmsText fieldId="customers.cta.primary">Book a walkthrough</CmsText>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

createRoot(document.getElementById("root")).render(<SiteApp />);
