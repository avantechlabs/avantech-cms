import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api.js";
import { humanizeSlug } from "../../humanize.js";
import { useRoute } from "../lib/router.js";
import styles from "./AppShell.module.css";

function siteHost(siteUrl, fallback) {
  try {
    return new URL(siteUrl).host;
  } catch {
    return fallback;
  }
}

function projectUrl(project) {
  return project?.siteUrl ?? project?.editUrl ?? project?.origin ?? "";
}

function NavToggle({ open, onToggle, label }) {
  return (
    <button
      type="button"
      className={styles.navToggle}
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? `Hide ${label}` : `Show ${label}`}
    >
      <svg
        className={open ? styles.toggleOpen : undefined}
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}

const NAV_ICONS = {
  editor: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  pages: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  ),
  collections: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </svg>
  ),
  media: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.5-3.5L6 23" />
    </svg>
  ),
  settings: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
    </svg>
  ),
};

export function AppShell({ project, projects, section, isAdmin, email, children }) {
  const { signOut } = useAuthActions();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("cms.sidebar") === "collapsed",
  );
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef(null);

  // The editor's floating chrome (rail, bottom bar) is fixed to the viewport;
  // this variable tells it how much room the sidebar takes.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--shell-inset", collapsed ? "56px" : "232px");
    return () => root.style.removeProperty("--shell-inset");
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem("cms.sidebar", collapsed ? "collapsed" : "open");
  }, [collapsed]);

  // Close the switcher on Escape or an outside click.
  useEffect(() => {
    if (!switcherOpen) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setSwitcherOpen(false);
    }
    function onClick(event) {
      if (!switcherRef.current?.contains(event.target)) setSwitcherOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onClick);
    };
  }, [switcherOpen]);

  const slug = project?.slug;
  const [pagesOpen, setPagesOpen] = useState(true);
  const [collectionsOpen, setCollectionsOpen] = useState(true);
  const pages = useQuery(
    api.cms.listPages,
    slug ? { projectSlug: slug } : "skip",
  ) ?? [];
  const collections = useQuery(
    api.cms.listCollections,
    slug ? { projectSlug: slug } : "skip",
  ) ?? [];

  const { search } = useRoute();
  const params = new URLSearchParams(search);
  const currentCollection = section === "editor" ? params.get("collection") : null;
  const currentPage =
    section === "editor" && !currentCollection ? params.get("page") || "home" : null;

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar}${collapsed ? ` ${styles.collapsed}` : ""}`}>
        <div className={styles.switcher} ref={switcherRef}>
          <button
            type="button"
            className={styles.switcherBtn}
            onClick={() => setSwitcherOpen((open) => !open)}
            aria-expanded={switcherOpen}
            aria-haspopup="listbox"
            title={project ? project.name : "Choose a site"}
          >
            <span className={styles.siteMark} aria-hidden="true">
              {(project?.name ?? "+").slice(0, 1)}
            </span>
            <span className={styles.switcherText}>
              <strong>{project ? project.name : "New site"}</strong>
              {project && <small>{siteHost(projectUrl(project), project.slug)}</small>}
            </span>
            <svg className={styles.chevron} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
            </svg>
          </button>

          {switcherOpen && (
            <div className={styles.switcherMenu} role="listbox" aria-label="Sites">
              {projects.map((item) => (
                <a
                  key={item._id}
                  role="option"
                  aria-selected={item.slug === slug}
                  className={`${styles.switcherItem}${item.slug === slug ? ` ${styles.current}` : ""}`}
                  href={`/cms/${item.slug}${section === "pages" ? "/pages" : section === "settings" && isAdmin ? "/settings" : ""}`}
                >
                  <strong>{item.name}</strong>
                  <small>{siteHost(projectUrl(item), item.slug)}</small>
                </a>
              ))}
              {isAdmin && (
                <a className={styles.switcherNew} href="/cms/new/settings">
                  + New site
                </a>
              )}
            </div>
          )}
        </div>

        <nav className={styles.nav} aria-label="Site sections">
          <a
            className={`${styles.navItem}${section === "editor" && !currentCollection ? ` ${styles.on}` : ""}`}
            href={slug ? `/cms/${slug}` : "/cms"}
            aria-current={section === "editor" && !currentCollection ? "page" : undefined}
            title="Editor"
          >
            {NAV_ICONS.editor}
            <span>Editor</span>
          </a>

          <span className={styles.navRow}>
            <a
              className={`${styles.navItem}${section === "pages" ? ` ${styles.on}` : ""}`}
              href={slug ? `/cms/${slug}/pages` : "/cms"}
              aria-current={section === "pages" ? "page" : undefined}
              title="Pages"
            >
              {NAV_ICONS.pages}
              <span>Pages</span>
            </a>
            {pages.length > 0 && (
              <NavToggle
                open={pagesOpen}
                onToggle={() => setPagesOpen((open) => !open)}
                label="pages"
              />
            )}
          </span>
          {pagesOpen && pages.length > 0 && (
            <div className={styles.subNav}>
              {pages.map((page) => (
                <a
                  key={page.slug}
                  className={`${styles.subItem}${currentPage === page.slug ? ` ${styles.on}` : ""}`}
                  href={`/cms/${slug}?page=${encodeURIComponent(page.slug)}`}
                  aria-current={currentPage === page.slug ? "page" : undefined}
                  title={page.title}
                >
                  <span>{page.title}</span>
                  {page.draftCount > 0 && (
                    <span className={styles.subDraft} title={`${page.draftCount} unpublished`} />
                  )}
                </a>
              ))}
            </div>
          )}

          <span className={styles.navRow}>
            <button
              type="button"
              className={`${styles.navItem}${currentCollection ? ` ${styles.on}` : ""}`}
              onClick={() => setCollectionsOpen((open) => !open)}
              aria-expanded={collectionsOpen}
              title="Collections"
            >
              {NAV_ICONS.collections}
              <span>Collections</span>
            </button>
            {collections.length > 0 && (
              <NavToggle
                open={collectionsOpen}
                onToggle={() => setCollectionsOpen((open) => !open)}
                label="collections"
              />
            )}
          </span>
          {collectionsOpen && collections.length > 0 && (
            <div className={styles.subNav}>
              {collections.map((collection) => (
                <a
                  key={collection.key}
                  className={`${styles.subItem}${currentCollection === collection.key ? ` ${styles.on}` : ""}`}
                  href={`/cms/${slug}?collection=${encodeURIComponent(collection.key)}`}
                  aria-current={currentCollection === collection.key ? "page" : undefined}
                  title={humanizeSlug(collection.key)}
                >
                  <span>{humanizeSlug(collection.key)}</span>
                  <span className={styles.subCount}>{collection.count}</span>
                </a>
              ))}
            </div>
          )}
          {collectionsOpen && slug && collections.length === 0 && (
            <div className={styles.subNav}>
              <span className={styles.subEmpty}>No collections yet</span>
            </div>
          )}

          <span className={`${styles.navItem} ${styles.disabled}`} title="Media — coming soon">
            {NAV_ICONS.media}
            <span>Media</span>
          </span>

          {isAdmin && (
            <a
              className={`${styles.navItem}${section === "settings" ? ` ${styles.on}` : ""}`}
              href={slug ? `/cms/${slug}/settings` : "/cms/new/settings"}
              aria-current={section === "settings" ? "page" : undefined}
              title="Site settings"
            >
              {NAV_ICONS.settings}
              <span>Site settings</span>
            </a>
          )}
        </nav>

        <div className={styles.foot}>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {collapsed ? <path d="m9 18 6-6-6-6" /> : <path d="m15 18-6-6 6-6" />}
            </svg>
          </button>
          <div className={styles.who} title={email || "Signed in"}>
            <span className={styles.whoDot} aria-hidden="true" />
            <span className={styles.whoEmail}>{email || "Signed in"}</span>
          </div>
          <button type="button" className={styles.signOut} onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </aside>

      <main className={styles.content}>{children}</main>
    </div>
  );
}
