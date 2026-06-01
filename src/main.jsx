import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { CollectionsRailSection } from "./CollectionsRailSection.jsx";
import { RecordPanel } from "./RecordPanel.jsx";
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

// Owners never see raw field ids. Build a plain, sentence-cased phrase and keep
// the descriptive noun ("hero.image" -> "Hero image") so the label reads as a
// thing an owner recognizes, not a codeword or a raw id.
const FIELD_SYNONYMS = {
  desc: "description", cta: "button", subtitle: "subtitle", lede: "intro",
  eyebrow: "label", copy: "text", nav: "nav", brand: "brand", hero: "hero",
  stats: "stat", features: "feature", steps: "step", testimonial: "quote",
};

function imageFieldTitle(fieldId) {
  const phrase = fieldId
    .split(".")
    .map((seg) => {
      if (/^\d+$/.test(seg)) return String(Number(seg) + 1);
      if (FIELD_SYNONYMS[seg]) return FIELD_SYNONYMS[seg];
      return seg.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
    })
    .join(" ")
    .toLowerCase();
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Create the Convex client once at module load, not per render.
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

function CmsApp() {
  if (!convexClient) {
    return (
      <div className="missingConfig">
        <h1>Avantech CMS</h1>
        <p>Set VITE_CONVEX_URL to connect this prototype to Convex.</p>
      </div>
    );
  }
  return (
    <ConvexProvider client={convexClient}>
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
    uploadImageDraft,
    publish,
    discard,
    resetForProject,
  } = useFieldManager(projectSlug);

  const [mode, setMode] = useState("edit");
  const [theme, setTheme] = useState("light");
  const [railOpen, setRailOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [hint, setHint] = useState(false);
  const [collections, setCollections] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null); // { fieldId, url }
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imageError, setImageError] = useState(null);
  const fieldsByIdRef = useRef(new Map());
  const imageInputRef = useRef(null);
  const imageCardRef = useRef(null);
  const pendingUrlRef = useRef(null); // latest object URL, for cleanup
  const uploadSeqRef = useRef(0); // ignore a superseded upload's UI effects
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
      // Resend current content + draft markers so an iframe reload re-hydrates
      // (onReady fires again on every reload at the same origin).
      if (previewFields && Object.keys(previewFields).length) {
        send({ type: "cms:apply-fields", fields: previewFields });
      }
      send({ type: "cms:set-drafts", fieldIds: draftFieldIds });
    },
    onFields: (nextFields) => {
      fieldsByIdRef.current = new Map(nextFields.map((field) => [field.id, field]));
      setSelectedField((current) =>
        current ? fieldsByIdRef.current.get(current.id) ?? current : null,
      );

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
    onCollections: setCollections,
    onRecordClicked: (collectionKey, itemSlug) => {
      closeImageCard();
      setSelectedRecord({ collectionKey, itemSlug });
    },
    onFieldChanged: (fieldId, value) => {
      saveDraftField(fieldId, value);
      showToast("Saved");
    },
    onFieldClicked: (fieldId, kind) => {
      const field = fieldsByIdRef.current.get(fieldId) ?? { id: fieldId, kind };
      setSelectedField({ ...field, kind: field.kind ?? kind ?? "text" });
    },
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
    setCollections([]);
    setSelectedField(null);
    setSelectedRecord(null);
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

  // Esc closes the rail (universal "back out one level" for the panel).
  useEffect(() => {
    if (!railOpen) return;
    function onKey(event) {
      if (event.key === "Escape") setRailOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [railOpen]);

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

  function revokePendingUrl() {
    if (pendingUrlRef.current) {
      URL.revokeObjectURL(pendingUrlRef.current);
      pendingUrlRef.current = null;
    }
  }

  function onChooseImage() {
    imageInputRef.current?.click();
  }

  function onImageFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) handleImageFile(file);
  }

  function handleImageFile(file) {
    const field = selectedField?.kind === "image" ? selectedField : null;
    if (!field) return;

    setImageError(null);
    if (!file.type.startsWith("image/")) {
      setImageError("That file isn’t an image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("That image is over 10 MB — try a smaller one.");
      return;
    }

    const fieldId = field.id;
    const seq = ++uploadSeqRef.current;
    revokePendingUrl();
    const previewUrl = URL.createObjectURL(file);
    pendingUrlRef.current = previewUrl;
    setPendingPreview({ fieldId, url: previewUrl });
    setIsUploading(true);
    // Optimistic: the framed site shows the picked image instantly.
    send({ type: "cms:update-field", fieldId, value: previewUrl });

    uploadImageDraft(fieldId, file)
      .then(() => {
        if (seq !== uploadSeqRef.current) return; // a newer pick superseded this
        setIsUploading(false);
        showToast("Image saved as draft");
      })
      .catch((error) => {
        if (seq !== uploadSeqRef.current) return;
        setIsUploading(false);
        setImageError("Upload failed — please try again.");
        revokePendingUrl();
        setPendingPreview(null);
        if (previewFields[fieldId]) {
          send({ type: "cms:update-field", fieldId, value: previewFields[fieldId] });
        }
        console.error(error);
      });
  }

  function onImageDragOver(event) {
    event.preventDefault();
    setIsDragging(true);
  }
  function onImageDragLeave(event) {
    event.preventDefault();
    setIsDragging(false);
  }
  function onImageDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) handleImageFile(file);
  }

  function closeImageCard() {
    revokePendingUrl();
    setPendingPreview(null);
    setSelectedField(null);
    setImageError(null);
    setIsDragging(false);
    setIsUploading(false);
  }

  const projectName = project?.name || projectSlug;
  const selectedImageField = selectedField?.kind === "image" ? selectedField : null;
  const selectedRecordCollection = selectedRecord
    ? collections.find((collection) => collection.key === selectedRecord.collectionKey)
    : null;
  const imageFieldId = selectedImageField?.id ?? null;
  const imageTitle = imageFieldId ? imageFieldTitle(imageFieldId) : "";
  const imageIsDraft = imageFieldId ? draftFieldIds.includes(imageFieldId) : false;
  const imagePreviewSrc = imageFieldId
    ? (pendingPreview?.fieldId === imageFieldId ? pendingPreview.url : null) ||
      previewFields[imageFieldId] ||
      selectedImageField.value ||
      null
    : null;

  // Image card is non-modal: Esc and clicks outside it dismiss. Clicks inside
  // the framed site arrive as field messages, so this only covers parent chrome.
  useEffect(() => {
    if (!selectedImageField || mode !== "edit") return;
    function onKey(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeImageCard();
      }
    }
    function onPointerDown(event) {
      if (imageCardRef.current && !imageCardRef.current.contains(event.target)) {
        closeImageCard();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [selectedImageField, mode]);

  // Free any object URL still held when the editor unmounts.
  useEffect(() => () => revokePendingUrl(), []);

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
          <span className="title">Navigate</span>
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

        <CollectionsRailSection collections={collections} />

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
        <button className="barBtn" onClick={onDiscard} disabled={changeCount === 0}>Discard</button>
        <button className="barBtn primary" onClick={onPublish} disabled={changeCount === 0}>
          {changeCount > 0 && <span className="badge">{changeCount}</span>}
          Publish
        </button>
      </div>

      {selectedImageField && mode === "edit" && (
        <aside
          ref={imageCardRef}
          className={`imageCard${isDragging ? " dragging" : ""}`}
          aria-label={`Edit ${imageTitle} image`}
        >
          <div className="imageCardHead">
            <div className="imageCardMeta">
              <span className="imageCardEyebrow">Image</span>
              <span className="imageCardTitle">{imageTitle}</span>
            </div>
            <button className="railClose" onClick={closeImageCard} aria-label="Close">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <button
            type="button"
            className={`imageDrop${isDragging ? " drag" : ""}${isUploading ? " uploading" : ""}`}
            onClick={onChooseImage}
            onDragOver={onImageDragOver}
            onDragLeave={onImageDragLeave}
            onDrop={onImageDrop}
            aria-label="Replace image — click to choose a file, or drop one here"
          >
            {imagePreviewSrc ? (
              <img src={imagePreviewSrc} alt="" />
            ) : (
              <span className="imageDropEmpty">No image yet</span>
            )}
            <span className="imageDropHint">
              {isUploading ? (
                <><span className="spinner" aria-hidden="true" />Uploading…</>
              ) : (
                "Drop an image, or click to replace"
              )}
            </span>
          </button>

          {imageError ? (
            <p className="imageError" role="alert">{imageError}</p>
          ) : (
            <p className={`imageStatus${imageIsDraft ? " draft" : ""}`} aria-live="polite">
              <span className="dot" />
              {isUploading
                ? "Saving…"
                : imageIsDraft
                  ? "Draft — not published yet"
                  : "Published — live on your site"}
            </p>
          )}

          <div className="imageCardActions">
            <button className="barBtn primary" onClick={onChooseImage} disabled={isUploading}>
              {isUploading ? "Uploading…" : "Replace image"}
            </button>
          </div>

          <input
            ref={imageInputRef}
            className="fileInput"
            type="file"
            accept="image/*"
            onChange={onImageFileChange}
          />
        </aside>
      )}

      {selectedRecord && mode === "edit" && (
        <RecordPanel
          collection={selectedRecordCollection}
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}

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
