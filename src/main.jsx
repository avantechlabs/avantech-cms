import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useCmsProject } from "./hooks/useCmsProject.js";
import { useFieldManager } from "./hooks/useFieldManager.js";
import { useIframeMessaging } from "./hooks/useIframeMessaging.js";
import "./style.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const PAGE_SLUG = "home";

// Tokens the in-iframe bridge needs to match chrome theme (outlines, chip, drafts).
const BRIDGE_TOKENS = {
  light: {
    "--cms-gold": "#FDB714",
    "--cms-text": "#1A1916",
    "--cms-surface": "#FFFFFF",
    "--cms-line": "#E7E3DC",
    "--cms-draft": "#B7791F",
    "--cms-draft-tint": "rgba(183,121,31,0.10)",
  },
  dark: {
    "--cms-gold": "#FDB714",
    "--cms-text": "#F5F2EA",
    "--cms-surface": "#201E18",
    "--cms-line": "rgba(245,242,234,0.18)",
    "--cms-draft": "#E0A94A",
    "--cms-draft-tint": "rgba(224,169,74,0.12)",
  },
};

function getProjectSlug() {
  const [, first, second] = window.location.pathname.split("/");
  if (first === "cms" && second) return second;
  return first || "project-a";
}

function CmsApp() {
  if (!convexUrl) {
    return (
      <div className="missingConfig">
        <h1>Avantech CMS</h1>
        <p>Set VITE_CONVEX_URL to connect this prototype to Convex.</p>
      </div>
    );
  }
  const convex = new ConvexReactClient(convexUrl);
  return (
    <ConvexProvider client={convex}>
      <Cms />
    </ConvexProvider>
  );
}

function Cms() {
  const projectSlug = getProjectSlug();

  const {
    projects,
    project,
    previewFields,
    publishedFields,
    draftFieldIds,
    previewOrigin,
    siteUrl,
    ensureSeedData,
  } = useCmsProject(projectSlug);

  const {
    saveState,
    seededSignatureRef,
    seedDiscoveredFields,
    saveDraftField,
    publish,
    discard,
    resetForProject,
  } = useFieldManager(projectSlug);

  const [mode, setMode] = useState("edit");
  const [theme, setTheme] = useState("light");
  const [railOpen, setRailOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [hint, setHint] = useState(false);
  const toastTimer = useRef(null);
  const hintTimer = useRef(null);

  const changeCount = draftFieldIds.length;
  const draftSignature = draftFieldIds.slice().sort().join("|");

  const { iframeRef, send } = useIframeMessaging({
    previewOrigin,
    projectSlug,
    onReady: () => {
      send({ type: "cms:discover-fields" });
      send({ type: "cms:set-mode", mode });
      send({ type: "cms:set-theme", theme, tokens: BRIDGE_TOKENS[theme] });
    },
    onFields: (nextFields) => {
      const editable = nextFields.filter((f) => f.editable !== false);
      const signature = editable.map((f) => f.id).sort().join("|");
      if (signature && signature !== seededSignatureRef.current) {
        seededSignatureRef.current = signature;
        seedDiscoveredFields({
          projectSlug,
          pageSlug: PAGE_SLUG,
          fields: editable.map((f) => ({ id: f.id, value: f.value })),
        }).then((seeded) => {
          if (seeded) send({ type: "cms:apply-fields", fields: seeded });
        });
      }
    },
    onFieldChanged: (fieldId, value) => {
      saveDraftField(fieldId, value);
      showToast("Saved");
    },
    onFieldClicked: () => {},
    onEditing: () => {},
  });

  // Keep the framed site showing draft ⊕ published.
  useEffect(() => {
    if (previewFields && Object.keys(previewFields).length) {
      send({ type: "cms:apply-fields", fields: previewFields });
    }
  }, [previewFields, send]);

  // Mark which fields carry unpublished drafts (visible material).
  useEffect(() => {
    send({ type: "cms:set-drafts", fieldIds: draftFieldIds });
  }, [draftSignature, send]);

  useEffect(() => {
    ensureSeedData();
  }, [ensureSeedData]);

  useEffect(() => {
    resetForProject();
  }, [projectSlug]);

  // Mode → html attribute (drives chrome recede) + iframe affordances + first-run hint.
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    send({ type: "cms:set-mode", mode });
    if (mode === "view") setRailOpen(false);
    if (mode === "edit" && !sessionStorage.getItem("cms-hint-seen")) {
      sessionStorage.setItem("cms-hint-seen", "1");
      setHint(true);
      clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => setHint(false), 3200);
    }
  }, [mode, send]);

  // Theme → html attribute (chrome) + iframe toolbar/outline tokens.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    send({ type: "cms:set-theme", theme, tokens: BRIDGE_TOKENS[theme] });
  }, [theme, send]);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1800);
  }

  function onPublish() {
    if (changeCount === 0) {
      showToast("Nothing to publish yet");
      return;
    }
    const n = changeCount;
    publish().then(() => showToast(`Published ${n} change${n > 1 ? "s" : ""}`));
  }

  function onDiscard() {
    if (changeCount === 0) return;
    const n = changeCount;
    if (!window.confirm(`Discard ${n} unpublished change${n > 1 ? "s" : ""}?`)) return;
    discard().then(() => {
      send({ type: "cms:apply-fields", fields: publishedFields });
      showToast("Discarded");
    });
  }

  const projectName = project?.name || projectSlug;

  return (
    <div className="stage">
      {/* Mode + theme dock */}
      <div className="dock">
        <button
          className="iconBtn"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
        <div className="modeToggle" role="group" aria-label="Mode">
          <button className={mode === "view" ? "on" : ""} onClick={() => setMode("view")}>View</button>
          <button className={mode === "edit" ? "on" : ""} onClick={() => setMode("edit")}>Edit</button>
        </div>
      </div>

      {/* Collections rail */}
      <button className="railTab" onClick={() => setRailOpen((o) => !o)} aria-label="Open collections">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </button>
      {railOpen && <div className="scrim" onClick={() => setRailOpen(false)} />}
      <aside className={`rail${railOpen ? " open" : ""}`} aria-hidden={!railOpen}>
        <div className="railHead">
          <span className="title">Collections</span>
          <button className="railClose" onClick={() => setRailOpen(false)} aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="railGroup">
          <div className="railLabel">Sites</div>
          {projects.map((item) => (
            <a key={item._id} className={`railRow${item.slug === projectSlug ? " on" : ""}`} href={`/cms/${item.slug}`}>
              {item.name}
              {item.slug === projectSlug && changeCount > 0 && <span className="draftDot" />}
            </a>
          ))}
        </div>

        <div className="railGroup">
          <div className="railLabel">Pages</div>
          <div className="railRow on">
            Home
            {changeCount > 0 && <span className="draftDot" />}
          </div>
        </div>

        <div className="railGroup">
          <div className="railLabel">Collections</div>
          <div className="railRow muted">No collections yet</div>
        </div>

        <div className="railGroup">
          <div className="railLabel">Media</div>
          <div className="railRow muted">No media yet</div>
        </div>
      </aside>

      {/* The framed customer site */}
      <div className="frame">
        {siteUrl ? (
          <iframe ref={iframeRef} src={siteUrl} title={`${projectName} preview`} />
        ) : (
          <div className="loading">Loading preview…</div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="bottomBar" role="toolbar" aria-label="Editor actions">
        <div className="status">
          <span className="dot" />
          <span>Editing {projectName}</span>
          {changeCount > 0 && <span className="unpublished">· {changeCount} unpublished</span>}
        </div>
        <span className="sep" />
        <button className="barBtn" onClick={() => showToast("History is coming soon")}>History</button>
        <button className="barBtn" onClick={onDiscard} disabled={changeCount === 0}>Discard</button>
        <button className="barBtn primary" onClick={onPublish} disabled={changeCount === 0}>
          {changeCount > 0 && <span className="badge">{changeCount}</span>}
          Publish
        </button>
      </div>

      {/* Toast + first-run hint */}
      <div className={`toast${toast ? " show" : ""}`} role="status">
        <span className="check">✓</span>
        <span>{toast}</span>
      </div>
      <div className={`hint${hint ? " show" : ""}`}>
        Click any text to edit · <span className="key">esc</span> to finish
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<CmsApp />);
