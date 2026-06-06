import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api.js";
import { CollectionBrowserPanel } from "./CollectionBrowserPanel.jsx";
import { CollectionsRailSection } from "./CollectionsRailSection.jsx";
import { RecordPanel } from "./RecordPanel.jsx";
import { useCmsProject } from "./hooks/useCmsProject.js";
import { useFieldManager } from "./hooks/useFieldManager.js";
import { useIframeMessaging } from "./hooks/useIframeMessaging.js";
import "./style.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

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
      {window.location.pathname.startsWith("/admin/projects") ? <ProjectsAdmin /> : <Cms />}
    </ConvexProvider>
  );
}

const emptyProjectForm = {
  slug: "",
  name: "",
  origin: "",
  editUrl: "",
};

function normalizeSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ProjectsAdmin() {
  const projects = useQuery(api.cms.listProjects) ?? [];
  const ensureSeedData = useMutation(api.cms.ensureSeedData);
  const createProject = useMutation(api.cms.createProject);
  const updateProject = useMutation(api.cms.updateProject);
  const [draft, setDraft] = useState(emptyProjectForm);
  const [editingSlug, setEditingSlug] = useState(null);
  const [saveState, setSaveState] = useState("idle");

  useEffect(() => {
    ensureSeedData();
  }, [ensureSeedData]);

  const editingProject = editingSlug
    ? projects.find((project) => project.slug === editingSlug)
    : null;
  const canSave =
    draft.slug.trim() &&
    draft.name.trim() &&
    draft.origin.trim() &&
    draft.editUrl.trim() &&
    saveState !== "saving";

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setEditingSlug(null);
    setDraft(emptyProjectForm);
    setSaveState("idle");
  }

  function startEdit(project) {
    setEditingSlug(project.slug);
    setDraft({
      slug: project.slug,
      name: project.name,
      origin: project.origin,
      editUrl: project.editUrl,
    });
    setSaveState("idle");
  }

  function onSubmit(event) {
    event.preventDefault();
    if (!canSave) return;

    const payload = {
      slug: normalizeSlug(draft.slug),
      name: draft.name.trim(),
      origin: draft.origin.trim(),
      editUrl: draft.editUrl.trim(),
    };

    setSaveState("saving");
    const action = editingProject
      ? updateProject({ ...payload, slug: editingProject.slug })
      : createProject(payload);

    action
      .then((project) => {
        setSaveState("saved");
        if (project?.slug) {
          setEditingSlug(project.slug);
          setDraft({
            slug: project.slug,
            name: project.name,
            origin: project.origin,
            editUrl: project.editUrl,
          });
        } else {
          resetForm();
        }
      })
      .catch((error) => {
        console.error(error);
        setSaveState("error");
      });
  }

  return (
    <main className="adminShell">
      <header className="adminTop">
        <div>
          <p className="adminEyebrow">Admin</p>
          <h1>Projects</h1>
        </div>
        <a className="barBtn primary" href={`/cms/${projects[0]?.slug ?? "project-a"}`}>
          Open editor
        </a>
      </header>

      <section className="adminGrid" aria-label="Project registry">
        <div className="adminPanel">
          <div className="adminPanelHead">
            <h2>Registered sites</h2>
            <button className="barBtn" type="button" onClick={resetForm}>
              New project
            </button>
          </div>
          <div className="projectList">
            {projects.length > 0 ? (
              projects.map((project) => (
                <article
                  key={project._id}
                  className={`projectRow${project.slug === editingSlug ? " on" : ""}`}
                >
                  <button type="button" onClick={() => startEdit(project)}>
                    <strong>{project.name}</strong>
                    <span>{project.slug}</span>
                  </button>
                  <a href={`/cms/${project.slug}`}>Edit</a>
                </article>
              ))
            ) : (
              <p className="adminEmpty">No projects registered yet.</p>
            )}
          </div>
        </div>

        <form className="adminPanel projectForm" onSubmit={onSubmit}>
          <div className="adminPanelHead">
            <h2>{editingProject ? "Edit project" : "Create project"}</h2>
            {saveState === "saved" && <span className="savePill">Saved</span>}
            {saveState === "error" && <span className="savePill error">Couldn’t save</span>}
          </div>

          <label>
            <span>Name</span>
            <input
              value={draft.name}
              onChange={(event) => updateDraft("name", event.target.value)}
              placeholder="Sable"
            />
          </label>

          <label>
            <span>Slug</span>
            <input
              value={draft.slug}
              onChange={(event) => updateDraft("slug", normalizeSlug(event.target.value))}
              placeholder="sable"
              disabled={Boolean(editingProject)}
            />
          </label>

          <label>
            <span>Origin</span>
            <input
              value={draft.origin}
              onChange={(event) => updateDraft("origin", event.target.value)}
              placeholder="https://sable.com"
            />
          </label>

          <label>
            <span>Edit URL</span>
            <input
              value={draft.editUrl}
              onChange={(event) => updateDraft("editUrl", event.target.value)}
              placeholder="https://sable.com"
            />
          </label>

          <div className="adminActions">
            <button className="barBtn primary" type="submit" disabled={!canSave}>
              {saveState === "saving" ? "Saving…" : editingProject ? "Update project" : "Create project"}
            </button>
            {editingProject && (
              <a className="barBtn" href={`/cms/${editingProject.slug}`}>
                Open editor
              </a>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}

function Cms() {
  const projectSlug = getProjectSlug();
  const [selectedPageSlug, setSelectedPageSlug] = useState("home");
  const [selectedLanguage, setSelectedLanguage] = useState("fr");

  const {
    projects,
    project,
    page,
    pages,
    previewFields,
    publishedFields,
    draftFieldIds,
    siteDraftCount,
    collectionDrafts,
    previewOrigin,
    siteUrl,
    ensureSeedData,
  } = useCmsProject(projectSlug, selectedPageSlug, selectedLanguage);

  const {
    saveState,
    seededSignatureRef,
    seedDiscoveredFields,
    saveDraftField,
    uploadImageDraft,
    publish,
    discard,
    resetForProject,
  } = useFieldManager(projectSlug, selectedPageSlug, selectedLanguage);

  const [mode, setMode] = useState("edit");
  const [theme, setTheme] = useState("light");
  const [railOpen, setRailOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [hint, setHint] = useState(false);
  const [collections, setCollections] = useState([]);
  const [selectedCollectionKey, setSelectedCollectionKey] = useState(null);
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

  const changeCount = siteDraftCount;
  const draftSignature = draftFieldIds.slice().sort().join("|");
  const collectionDraftSignature = collectionDrafts
    .map((draft) => `${draft.collectionKey}:${draft.slug}`)
    .sort()
    .join("|");
  const activeCollectionKey = selectedRecord?.collectionKey ?? selectedCollectionKey;
  const previewCollectionItems = useQuery(
    api.cms.listPreviewCollectionItems,
    activeCollectionKey
      ? { projectSlug, collectionKey: activeCollectionKey, language: selectedLanguage }
      : "skip",
  ) ?? [];
  const saveCollectionItemDraft = useMutation(api.cms.saveCollectionItemDraft);
  const createCollectionItemDraft = useMutation(api.cms.createCollectionItemDraft);
  const generateCollectionFileUploadUrl = useMutation(api.cms.generateCollectionFileUploadUrl);
  const syncPages = useMutation(api.cms.syncPages);

  const { iframeRef, send } = useIframeMessaging({
    previewOrigin,
    projectSlug,
    pageSlug: selectedPageSlug,
    onReady: () => {
      send({ type: "cms:discover-fields" });
      send({ type: "cms:set-language", language: selectedLanguage });
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
          pageSlug: selectedPageSlug,
          fields: editable.map((f) => ({ id: f.id, value: f.value })),
        }).then((seeded) => {
          if (seeded) send({ type: "cms:apply-fields", fields: seeded });
        });
      }
    },
    onPages: (nextPages) => {
      const normalizedPages = (nextPages || [])
        .filter((item) => item?.slug && item?.title && item?.path)
        .map((item) => ({
          slug: String(item.slug),
          title: String(item.title),
          path: String(item.path),
        }));
      if (!normalizedPages.length) return;

      syncPages({ projectSlug, pages: normalizedPages }).catch((error) => {
        console.error(error);
        showToast("Couldn’t sync pages");
      });
      setSelectedPageSlug((current) =>
        normalizedPages.some((item) => item.slug === current)
          ? current
          : normalizedPages[0].slug,
      );
    },
    onCollections: setCollections,
    onRecordClicked: (collectionKey, itemSlug) => {
      closeImageCard();
      setSelectedCollectionKey(null);
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
    send({ type: "cms:set-language", language: selectedLanguage });
  }, [selectedLanguage, send]);

  useEffect(() => {
    send({ type: "cms:set-draft-records", records: collectionDrafts });
  }, [collectionDraftSignature, send]);

  useEffect(() => {
    ensureSeedData();
  }, [ensureSeedData]);

  useEffect(() => {
    setSelectedPageSlug("home");
  }, [projectSlug]);

  useEffect(() => {
    resetForProject();
    setCollections([]);
    setSelectedCollectionKey(null);
    setSelectedField(null);
    setSelectedRecord(null);
  }, [projectSlug, selectedPageSlug, selectedLanguage]);

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
  const pageName = page?.title || pages.find((item) => item.slug === selectedPageSlug)?.title || "Home";
  const selectedImageField = selectedField?.kind === "image" ? selectedField : null;
  const selectedRecordCollection = selectedRecord
    ? collections.find((collection) => collection.key === selectedRecord.collectionKey)
    : null;
  const selectedCollection = selectedCollectionKey
    ? collections.find((collection) => collection.key === selectedCollectionKey)
    : null;
  const selectedRecordData = selectedRecord
    ? previewCollectionItems.find((item) => item.slug === selectedRecord.itemSlug)?.data
    : null;
  const selectedRecordIsDraft = selectedRecord
    ? collectionDrafts.some(
        (draft) =>
          draft.collectionKey === selectedRecord.collectionKey &&
          draft.slug === selectedRecord.itemSlug,
      )
    : false;
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
        <div className="modeToggle" role="group" aria-label="Language">
          <button
            className={selectedLanguage === "fr" ? "on" : ""}
            onClick={() => setSelectedLanguage("fr")}
          >
            FR
          </button>
          <button
            className={selectedLanguage === "en" ? "on" : ""}
            onClick={() => setSelectedLanguage("en")}
          >
            EN
          </button>
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
          {pages.length > 0 ? (
            pages.map((item) => (
              <button
                key={item.slug}
                type="button"
                className={`railRow${item.slug === selectedPageSlug ? " on" : ""}`}
                onClick={() => {
                  setRailOpen(false);
                  closeImageCard();
                  setSelectedCollectionKey(null);
                  setSelectedField(null);
                  setSelectedRecord(null);
                  setSelectedPageSlug(item.slug);
                }}
              >
                {item.title}
                {item.draftCount > 0 && <span className="draftDot" />}
              </button>
            ))
          ) : (
            <div className="railRow muted">No pages yet</div>
          )}
        </div>

        <CollectionsRailSection
          collections={collections}
          draftCollectionKeys={[...new Set(collectionDrafts.map((draft) => draft.collectionKey))]}
          onSelectCollection={(collectionKey) => {
            setRailOpen(false);
            setSelectedField(null);
            setSelectedRecord(null);
            setSelectedCollectionKey(collectionKey);
          }}
        />

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
          <span>Editing {projectName} / {pageName}</span>
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
          recordData={selectedRecordData}
          isDraft={selectedRecordIsDraft}
          onFieldChange={(path, value) => {
            // Scalar saves are fire-and-forget; errors surface as a toast, never
            // an unhandled rejection.
            saveCollectionItemDraft({
              projectSlug,
              collectionKey: selectedRecord.collectionKey,
              slug: selectedRecord.itemSlug,
              language: selectedLanguage,
              path,
              value,
            })
              .then(() => showToast("Saved"))
              .catch((error) => {
                console.error(error);
                showToast("Couldn’t save");
              });
          }}
          onUploadFile={async (path, file) => {
            // Awaitable: the picker shows progress and surfaces failures.
            const uploadUrl = await generateCollectionFileUploadUrl({
              projectSlug,
              collectionKey: selectedRecord.collectionKey,
              slug: selectedRecord.itemSlug,
              path,
            });
            if (!uploadUrl) throw new Error("Unable to create file upload URL.");

            const response = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": file.type || "application/octet-stream" },
              body: file,
            });
            if (!response.ok) throw new Error(`File upload failed with status ${response.status}.`);

            const { storageId } = await response.json();
            if (!storageId) throw new Error("File upload did not return a storage ID.");

            await saveCollectionItemDraft({
              projectSlug,
              collectionKey: selectedRecord.collectionKey,
              slug: selectedRecord.itemSlug,
              language: selectedLanguage,
              path,
              value: `convex-storage:${storageId}`,
            });
            showToast("Saved");
          }}
          onClose={() => setSelectedRecord(null)}
        />
      )}

      {selectedCollection && !selectedRecord && mode === "edit" && (
        <CollectionBrowserPanel
          collection={selectedCollection}
          records={previewCollectionItems}
          draftSlugs={collectionDrafts
            .filter((draft) => draft.collectionKey === selectedCollection.key)
            .map((draft) => draft.slug)}
          onCreate={(slug) => {
            const data = selectedCollection.defaultItem ?? {};
            createCollectionItemDraft({
              projectSlug,
              collectionKey: selectedCollection.key,
              slug,
              language: selectedLanguage,
              data,
            }).then(() => {
              setSelectedRecord({ collectionKey: selectedCollection.key, itemSlug: slug });
              setSelectedCollectionKey(null);
              showToast("Record saved as draft");
            });
          }}
          onSelectRecord={(slug) => {
            setSelectedRecord({ collectionKey: selectedCollection.key, itemSlug: slug });
            setSelectedCollectionKey(null);
          }}
          onClose={() => setSelectedCollectionKey(null)}
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
