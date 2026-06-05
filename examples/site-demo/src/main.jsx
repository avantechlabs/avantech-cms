import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import {
  CmsContentProvider,
  CmsPagesProvider,
  CmsText,
  useEditBridge,
} from "../../shared/useCmsPage.jsx?cmsPagesProvider";
import "./style.css";

const IconInvoice = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const IconConnect = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const IconPay = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const FEATURES = [
  {
    icon: <IconInvoice />,
    n: "01",
    title: "Invoice on-site",
    desc: "Generate accurate invoices the moment the job is done — before the truck pulls away.",
    field: "features.1",
  },
  {
    icon: <IconConnect />,
    n: "02",
    title: "Connect your workflow",
    desc: "Syncs with your existing dispatch, scheduling, and accounting tools out of the box.",
    field: "features.2",
  },
  {
    icon: <IconPay />,
    n: "03",
    title: "Get paid faster",
    desc: "Customers receive invoices instantly and can pay before the next job is dispatched.",
    field: "features.3",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Complete the work order",
    desc: "Your tech fills out job details on their phone — materials, labour, and notes.",
    field: "steps.1",
  },
  {
    n: "02",
    title: "Avantech builds the invoice",
    desc: "Line items, tax, and totals are calculated automatically from the work order.",
    field: "steps.2",
  },
  {
    n: "03",
    title: "Customer pays on the spot",
    desc: "A payment link lands in the customer's inbox before the next job is underway.",
    field: "steps.3",
  },
];

const PROJECT_SLUG = "project-a";
const PAGES = [
  { slug: "home", title: "Home", path: "/" },
  { slug: "pricing", title: "Pricing", path: "/pricing" },
];
const convexUrl = import.meta.env.VITE_CONVEX_URL;

function currentPage() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return PAGES.find((page) => page.path === path) ?? PAGES[0];
}

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

  if (pageSlug === "pricing") return <PricingPage />;

  return <HomePage />;
}

function HomePage() {
  return (
    <>
      <nav className="nav" data-cms-field="nav">
        <div className="nav-inner">
          <a href="/" className="nav-brand" data-cms-field="nav.brand">
            <CmsText fieldId="nav.brand">Avantech</CmsText>
          </a>
          <div className="nav-links">
            <a href="#features" data-cms-field="nav.features">
              <CmsText fieldId="nav.features">Features</CmsText>
            </a>
            <a href="#how-it-works" data-cms-field="nav.howItWorks">
              <CmsText fieldId="nav.howItWorks">How it works</CmsText>
            </a>
            <a href="#" className="nav-cta" data-cms-field="nav.cta">
              <CmsText fieldId="nav.cta">Get started</CmsText>
            </a>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-inner">
          <span className="hero-eyebrow" data-cms-field="hero.eyebrow">
            <CmsText fieldId="hero.eyebrow">Field service billing</CmsText>
          </span>
          <h1 data-cms-field="hero.title">
            <CmsText fieldId="hero.title">Billing that keeps field teams moving.</CmsText>
          </h1>
          <p className="hero-sub" data-cms-field="hero.subtitle">
            <CmsText fieldId="hero.subtitle">
              Create accurate invoices from completed work orders before the truck leaves the job.
            </CmsText>
          </p>
          <div className="hero-actions">
            <a href="#" className="btn-primary" data-cms-field="hero.cta">
              <CmsText fieldId="hero.cta">Start faster billing</CmsText>
            </a>
            <a href="#how-it-works" className="btn-ghost" data-cms-field="hero.cta-secondary">
              <CmsText fieldId="hero.cta-secondary">See how it works</CmsText>
            </a>
          </div>
        </div>
        <div className="hero-watermark" aria-hidden="true">Av</div>
      </section>

      <section className="stats">
        <div className="stats-inner">
          <div className="stat">
            <span className="stat-number" data-cms-field="stats.1.number">
              <CmsText fieldId="stats.1.number">2,400+</CmsText>
            </span>
            <span className="stat-label" data-cms-field="stats.1.label">
              <CmsText fieldId="stats.1.label">field teams trust Avantech</CmsText>
            </span>
          </div>
          <div className="stat-sep" />
          <div className="stat">
            <span className="stat-number" data-cms-field="stats.2.number">
              <CmsText fieldId="stats.2.number">98%</CmsText>
            </span>
            <span className="stat-label" data-cms-field="stats.2.label">
              <CmsText fieldId="stats.2.label">invoice accuracy rate</CmsText>
            </span>
          </div>
          <div className="stat-sep" />
          <div className="stat">
            <span className="stat-number" data-cms-field="stats.3.number">
              <CmsText fieldId="stats.3.number">4 min</CmsText>
            </span>
            <span className="stat-label" data-cms-field="stats.3.label">
              <CmsText fieldId="stats.3.label">average billing time</CmsText>
            </span>
          </div>
          <div className="stat-sep" />
          <div className="stat">
            <span className="stat-number" data-cms-field="stats.4.number">
              <CmsText fieldId="stats.4.number">$0</CmsText>
            </span>
            <span className="stat-label" data-cms-field="stats.4.label">
              <CmsText fieldId="stats.4.label">setup or onboarding fees</CmsText>
            </span>
          </div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="features-inner">
          <div className="features-header">
            <div>
              <p className="section-label" data-cms-field="features.label">
                <CmsText fieldId="features.label">Why Avantech</CmsText>
              </p>
              <h2 className="features-title" data-cms-field="features.title">
                <CmsText fieldId="features.title">Built for work that happens in the field.</CmsText>
              </h2>
            </div>
            <p className="features-aside" data-cms-field="features.aside">
              <CmsText fieldId="features.aside">
                Stop chasing invoices from the office. Avantech puts billing in the hands of the people doing the work.
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
              <CmsText fieldId="how.title">
                From job complete to payment received in three steps.
              </CmsText>
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

      <section className="testimonial">
        <div className="testimonial-inner">
          <h2 className="testimonial-lede" data-cms-field="testimonial.lede">
            <CmsText fieldId="testimonial.lede">What teams are saying.</CmsText>
          </h2>
          <div className="testimonial-body">
            <p className="testimonial-quote" data-cms-field="testimonial.quote">
              <CmsText fieldId="testimonial.quote">
                We used to chase invoices for weeks. Now we're paid before we drive away. Avantech changed how we run every job.
              </CmsText>
            </p>
            <div className="testimonial-attr">
              <span className="testimonial-name" data-cms-field="testimonial.name">
                <CmsText fieldId="testimonial.name">Marcus Reilly</CmsText>
              </span>
              <span className="testimonial-role" data-cms-field="testimonial.role">
                <CmsText fieldId="testimonial.role">Owner, Reilly Electrical Services</CmsText>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="cta-band-inner">
          <div className="cta-band-text">
            <h2 data-cms-field="cta.title">
              <CmsText fieldId="cta.title">Ready to bill from the job site?</CmsText>
            </h2>
            <p data-cms-field="cta.subtitle">
              <CmsText fieldId="cta.subtitle">
                Join 2,400 field service teams already using Avantech to get paid faster.
              </CmsText>
            </p>
          </div>
          <div className="cta-band-actions">
            <a href="#" className="btn-inverse" data-cms-field="cta.primary">
              <CmsText fieldId="cta.primary">Start faster billing</CmsText>
            </a>
            <span className="cta-band-note" data-cms-field="cta.note">
              <CmsText fieldId="cta.note">Free 14-day trial · No credit card required</CmsText>
            </span>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-brand" data-cms-field="footer.brand">
            <CmsText fieldId="footer.brand">Avantech</CmsText>
          </span>
          <div className="footer-links">
            <a href="#" data-cms-field="footer.link.1">
              <CmsText fieldId="footer.link.1">Features</CmsText>
            </a>
            <a href="#" data-cms-field="footer.link.2">
              <CmsText fieldId="footer.link.2">Pricing</CmsText>
            </a>
            <a href="#" data-cms-field="footer.link.3">
              <CmsText fieldId="footer.link.3">Support</CmsText>
            </a>
            <a href="#" data-cms-field="footer.link.4">
              <CmsText fieldId="footer.link.4">Privacy</CmsText>
            </a>
          </div>
          <p className="footer-copy" data-cms-field="footer.copy">
            <CmsText fieldId="footer.copy">© 2026 Avantech. All rights reserved.</CmsText>
          </p>
        </div>
      </footer>
    </>
  );
}

function PricingPage() {
  return (
    <>
      <nav className="nav" data-cms-field="pricing.nav">
        <div className="nav-inner">
          <a href="/" className="nav-brand" data-cms-field="pricing.nav.brand">
            <CmsText fieldId="pricing.nav.brand">Avantech</CmsText>
          </a>
          <div className="nav-links">
            <a href="/" data-cms-field="pricing.nav.home">
              <CmsText fieldId="pricing.nav.home">Home</CmsText>
            </a>
            <a href="/pricing" className="nav-cta" data-cms-field="pricing.nav.cta">
              <CmsText fieldId="pricing.nav.cta">Pricing</CmsText>
            </a>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-inner">
          <span className="hero-eyebrow" data-cms-field="pricing.hero.eyebrow">
            <CmsText fieldId="pricing.hero.eyebrow">Simple pricing</CmsText>
          </span>
          <h1 data-cms-field="pricing.hero.title">
            <CmsText fieldId="pricing.hero.title">Start billing faster without platform fees.</CmsText>
          </h1>
          <p className="hero-sub" data-cms-field="pricing.hero.subtitle">
            <CmsText fieldId="pricing.hero.subtitle">
              Pick the plan that fits your field team and scale when dispatch volume grows.
            </CmsText>
          </p>
          <div className="hero-actions">
            <a href="#" className="btn-primary" data-cms-field="pricing.hero.cta">
              <CmsText fieldId="pricing.hero.cta">Start a trial</CmsText>
            </a>
            <a href="/" className="btn-ghost" data-cms-field="pricing.hero.secondary">
              <CmsText fieldId="pricing.hero.secondary">Back to overview</CmsText>
            </a>
          </div>
        </div>
        <div className="hero-watermark" aria-hidden="true">$</div>
      </section>

      <section className="features">
        <div className="features-inner">
          <div className="features-header">
            <div>
              <p className="section-label" data-cms-field="pricing.plans.label">
                <CmsText fieldId="pricing.plans.label">Plans</CmsText>
              </p>
              <h2 className="features-title" data-cms-field="pricing.plans.title">
                <CmsText fieldId="pricing.plans.title">One workflow, two ways to start.</CmsText>
              </h2>
            </div>
            <p className="features-aside" data-cms-field="pricing.plans.aside">
              <CmsText fieldId="pricing.plans.aside">
                Every plan includes work orders, invoice generation, and payment links.
              </CmsText>
            </p>
          </div>
          <div className="features-grid">
            <div className="feature-card" data-cms-field="pricing.plan.starter">
              <p className="feature-n" data-cms-field="pricing.plan.starter.price">
                <CmsText fieldId="pricing.plan.starter.price">$49/mo</CmsText>
              </p>
              <h3 className="feature-title" data-cms-field="pricing.plan.starter.title">
                <CmsText fieldId="pricing.plan.starter.title">Starter</CmsText>
              </h3>
              <p className="feature-desc" data-cms-field="pricing.plan.starter.desc">
                <CmsText fieldId="pricing.plan.starter.desc">
                  For small crews that need job-site invoicing without extra admin.
                </CmsText>
              </p>
            </div>
            <div className="feature-card" data-cms-field="pricing.plan.growth">
              <p className="feature-n" data-cms-field="pricing.plan.growth.price">
                <CmsText fieldId="pricing.plan.growth.price">$149/mo</CmsText>
              </p>
              <h3 className="feature-title" data-cms-field="pricing.plan.growth.title">
                <CmsText fieldId="pricing.plan.growth.title">Growth</CmsText>
              </h3>
              <p className="feature-desc" data-cms-field="pricing.plan.growth.desc">
                <CmsText fieldId="pricing.plan.growth.desc">
                  For dispatch teams that need approvals, reporting, and accounting sync.
                </CmsText>
              </p>
            </div>
            <div className="feature-card" data-cms-field="pricing.plan.enterprise">
              <p className="feature-n" data-cms-field="pricing.plan.enterprise.price">
                <CmsText fieldId="pricing.plan.enterprise.price">Custom</CmsText>
              </p>
              <h3 className="feature-title" data-cms-field="pricing.plan.enterprise.title">
                <CmsText fieldId="pricing.plan.enterprise.title">Enterprise</CmsText>
              </h3>
              <p className="feature-desc" data-cms-field="pricing.plan.enterprise.desc">
                <CmsText fieldId="pricing.plan.enterprise.desc">
                  For multi-region operations with procurement, compliance, and SSO needs.
                </CmsText>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

createRoot(document.getElementById("root")).render(<SiteApp />);
