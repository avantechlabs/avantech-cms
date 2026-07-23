import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient, useMutation, useQuery } from "convex/react";
import {
  ConvexAuthProvider,
  useAuthActions,
  useConvexAuth,
} from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api.js";
import { BRIDGE_TOKENS } from "./cms/editor/lib/bridgeTokens";
import { imageFieldTitle, MAX_IMAGE_BYTES } from "./cms/editor/lib/imageFields";
import { CollectionBrowserPanel } from "./cms/editor/sections/collectionBrowser/CollectionBrowserPanel.jsx";
import { BottomBar } from "./cms/editor/sections/bottomBar/BottomBar";
import { Dock } from "./cms/editor/sections/dock/Dock";
import { ImagePanel } from "./cms/editor/sections/imagePanel/ImagePanel";
import { PreviewFrame } from "./cms/editor/sections/previewFrame/PreviewFrame";
import { EditorUx } from "./cms/editor/sections/ux/EditorUx";
import { RecordPanel } from "./cms/editor/sections/recordPanel/RecordPanel.jsx";
import { SignInPage } from "./cms/auth/SignInPage.jsx";
import { SessionBar } from "./cms/auth/SessionBar.jsx";
import { AppShell } from "./cms/shell/AppShell.jsx";
import { useLinkInterceptor, useRoute } from "./cms/lib/router.js";
import { PagesView } from "./cms/views/PagesView.jsx";
import { SiteSettings } from "./cms/views/SiteSettings.jsx";
import { useCmsProject } from "./hooks/useCmsProject.js";
import { useFieldManager } from "./hooks/useFieldManager.js";
import { useIframeMessaging } from "./hooks/useIframeMessaging.js";
import "./style.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

const SITE_SECTIONS = new Set(["pages", "settings"]);

export function getCmsRoute(pathname = window.location.pathname) {
  const parts = pathname.split("/").filter(Boolean);
  const rest = parts[0] === "cms" ? parts.slice(1) : parts;
  if (rest.length === 0) return { kind: "home" };
  const [projectSlug, second] = rest;
  return {
    kind: "site",
    projectSlug,
    section: SITE_SECTIONS.has(second) ? second : "editor",
  };
}

// Create the Convex client once at module load, not per render.
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

function CmsApp() {
  useLinkInterceptor();

  if (!convexClient) {
    return (
      <div className="missingConfig">
        <h1>Avantech CMS</h1>
        <p>Set VITE_CONVEX_URL to connect this prototype to Convex.</p>
      </div>
    );
  }
  return (
    <ConvexAuthProvider client={convexClient}>
      <AuthGate>
        <Cms />
      </AuthGate>
    </ConvexAuthProvider>
  );
}

function AuthGate({ children }) {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="missingConfig">
        <h1>Avantech CMS</h1>
        <p>Checking your session...</p>
      </div>
    );
  }

  if (!isAuthenticated) return <SignInPage />;

  return children;
}

function Cms() {
  const location = useRoute();
  const route = getCmsRoute(location.pathname);
  const projects = useQuery(api.cms.listProjects);
  const access = useQuery(api.cms.getCmsAccess);

  if (projects === undefined || access === undefined) {
    return <AccessMessage title="Just a moment" body="Checking your site access…" />;
  }

  const isAdmin = access?.isAdmin === true;
  const email = access?.email ?? "";

  const shell = (project, section, view) => (
    <AppShell
      project={project}
      projects={projects}
      section={section}
      isAdmin={isAdmin}
      email={email}
    >
      {view}
    </AppShell>
  );

  if (route.kind === "site" && route.projectSlug === "new") {
    if (!isAdmin) {
      return (
        <AccessMessage
          title="Access denied"
          body="Only an Avantech admin can create sites."
          action={<a className="barBtn primary" href="/cms">Return to sites</a>}
        />
      );
    }
    return shell(null, "settings", <SiteSettings key="new" project={null} />);
  }

  const project =
    route.kind === "home"
      ? projects[0]
      : projects.find((item) => item.slug === route.projectSlug);

  if (!project) {
    return projects.length === 0 ? (
      <NoAccess />
    ) : (
      <AccessMessage
        title="Access denied"
        body="You do not have access to this site."
        action={<a className="barBtn primary" href="/cms">Return to sites</a>}
      />
    );
  }

  const section = route.kind === "home" ? "editor" : route.section;

  if (section === "settings" && !isAdmin) {
    return (
      <AccessMessage
        title="Access denied"
        body="Site settings are managed by Avantech."
        action={<a className="barBtn primary" href={`/cms/${project.slug}`}>Back to the editor</a>}
      />
    );
  }

  if (section === "pages") {
    return shell(project, "pages", <PagesView key={project.slug} project={project} />);
  }
  if (section === "settings") {
    return shell(project, "settings", <SiteSettings key={project.slug} project={project} />);
  }
  return shell(project, "editor", <CmsEditor key={project.slug} projectSlug={project.slug} />);
}

function NoAccess() {
  return (
    <AccessMessage
      title="You’re not connected to a site yet"
      body="Site access is tied to the email you signed in with. If you’re expecting access, your Avantech contact can connect this email in a minute — or try signing in with the email your site was set up with."
    />
  );
}

function AccessMessage({ title, body, action = null }) {
  return (
    <main className="accessShell centered">
      <section className="accessPanel">
        <div className="accessPanelTop">
          <p className="adminEyebrow">Avantech CMS</p>
          <SessionBar />
        </div>
        <h1>{title}</h1>
        <p>{body}</p>
        {action}
      </section>
    </main>
  );
}

function CmsEditor({ projectSlug }) {
  const [selectedPageSlug, setSelectedPageSlug] = useState(
    () => new URLSearchParams(window.location.search).get("page") || "home",
  );
  const [selectedLanguage, setSelectedLanguage] = useState("en");

  const {
    projects,
    project,
    page,
    pages,
    previewFields,
    pageLanguage,
    publishedFields,
    draftFieldIds,
    siteDraftCount,
    collectionDrafts,
    previewOrigin,
    siteUrl,
    previewError,
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
  const [toast, setToast] = useState("");
  const [hint, setHint] = useState(false);
  const [collections, setCollections] = useState([]);
  const [selectedCollectionKey, setSelectedCollectionKey] = useState(
    () => new URLSearchParams(window.location.search).get("collection"),
  );
  const [selectedField, setSelectedField] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [pendingPreviews, setPendingPreviews] = useState({}); // fieldId -> object URL
  const [uploadingSlots, setUploadingSlots] = useState({});
  const [draggingSlots, setDraggingSlots] = useState({});
  const [imageErrors, setImageErrors] = useState({});
  const fieldsByIdRef = useRef(new Map());
  const imageInputRef = useRef(null);
  const imageCardRef = useRef(null);
  const pendingUrlsRef = useRef(new Map()); // fieldId -> object URL, for cleanup
  const uploadSeqRef = useRef(new Map()); // fieldId -> latest sequence
  const activeImageSlotRef = useRef(null);
  const toastTimer = useRef(null);
  const hintTimer = useRef(null);

  const changeCount = siteDraftCount;
  const draftSignature = draftFieldIds.slice().sort().join("|");
  const collectionDraftSignature = collectionDrafts
    .map((draft) => `${draft.collectionKey}:${draft.slug}`)
    .sort()
    .join("|");
  const cmsAccess = useQuery(api.cms.getCmsAccess);
  const canSyncStructure = cmsAccess?.isAdmin === true;
  const { signOut } = useAuthActions();
  const activeCollectionKey = selectedRecord?.collectionKey ?? selectedCollectionKey;
  const previewFieldsReadyForLanguage = pageLanguage === selectedLanguage;
  // Gate on cmsAccess so a ?collection= deep link doesn't fire this query
  // before the auth token reaches the connection.
  const previewCollectionItems = useQuery(
    api.cms.listPreviewCollectionItems,
    activeCollectionKey && cmsAccess
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
    frameKey: siteUrl,
    onReady: () => {
      send({ type: "cms:discover-fields" });
      send({ type: "cms:set-language", language: selectedLanguage });
      send({ type: "cms:set-mode", mode });
      send({ type: "cms:set-theme", theme, tokens: BRIDGE_TOKENS[theme] });
      // Resend current content + draft markers so an iframe reload re-hydrates
      // (onReady fires again on every reload at the same origin).
      if (previewFieldsReadyForLanguage && previewFields && Object.keys(previewFields).length) {
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
      const signature = editable
        .flatMap((field) => (
          field.kind === "image" && Array.isArray(field.slots) && field.slots.length
            ? field.slots.map((slot) => slot.fieldId)
            : [field.id]
        ))
        .sort()
        .join("|");
      if (canSyncStructure && signature && signature !== seededSignatureRef.current) {
        seededSignatureRef.current = signature;
        const fieldsToSeed = editable.flatMap((field) => {
          if (field.kind !== "image") return [{ id: field.id, value: field.value }];
          const slots = Array.isArray(field.slots) && field.slots.length
            ? field.slots
            : [{ fieldId: field.id, value: field.value }];
          return slots.map((slot) => ({
            id: slot.fieldId,
            value: slot.value,
            global: true,
          }));
        });
        seedDiscoveredFields({
          projectSlug,
          pageSlug: selectedPageSlug,
          fields: fieldsToSeed,
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
      if (!canSyncStructure) return;

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
    if (previewFieldsReadyForLanguage && previewFields && Object.keys(previewFields).length) {
      send({ type: "cms:apply-fields", fields: previewFields });
    }
  }, [previewFieldsReadyForLanguage, previewFields, send]);

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

  // Sidebar navigation within this site changes the query string without a
  // remount — mirror ?page= / ?collection= into editor state.
  const { search } = useRoute();
  useEffect(() => {
    const params = new URLSearchParams(search);
    setSelectedPageSlug(params.get("page") || "home");
    setSelectedCollectionKey(params.get("collection"));
  }, [search]);

  // Reset selection state when the page or language changes in-session — but
  // not on mount, or it would wipe the ?page= / ?collection= deep links.
  const selectionResetReady = useRef(false);
  useEffect(() => {
    if (!selectionResetReady.current) {
      selectionResetReady.current = true;
      return;
    }
    resetForProject();
    setCollections([]);
    setSelectedCollectionKey(null);
    setSelectedField(null);
    setSelectedRecord(null);
  }, [selectedPageSlug, selectedLanguage]);

  // Mode → html attribute (drives chrome recede) + iframe affordances + first-run hint.
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    send({ type: "cms:set-mode", mode });
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
    publish().then(() =>
      showToast(n > 1 ? `${n} changes are now live` : "Your change is now live"),
    );
  }

  function onDiscard() {
    if (changeCount === 0) return;
    discard().then(() => {
      send({ type: "cms:apply-fields", fields: publishedFields });
      showToast("Changes discarded — your live site is unchanged");
    });
  }

  function revokePendingUrl(fieldId = null) {
    if (fieldId) {
      const url = pendingUrlsRef.current.get(fieldId);
      if (url) URL.revokeObjectURL(url);
      pendingUrlsRef.current.delete(fieldId);
      return;
    }
    for (const url of pendingUrlsRef.current.values()) {
      URL.revokeObjectURL(url);
    }
    pendingUrlsRef.current.clear();
  }

  function onChooseImage(fieldId) {
    activeImageSlotRef.current = fieldId;
    imageInputRef.current?.click();
  }

  function onImageFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file && activeImageSlotRef.current) {
      handleImageFile(activeImageSlotRef.current, file);
    }
  }

  function handleImageFile(fieldId, file) {
    const field = selectedField?.kind === "image" ? selectedField : null;
    if (!field) return;

    setImageErrors((current) => ({ ...current, [fieldId]: null }));
    if (!file.type.startsWith("image/")) {
      setImageErrors((current) => ({ ...current, [fieldId]: "That file isn’t an image." }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageErrors((current) => ({
        ...current,
        [fieldId]: "That image is over 10 MB — try a smaller one.",
      }));
      return;
    }

    const seq = (uploadSeqRef.current.get(fieldId) ?? 0) + 1;
    uploadSeqRef.current.set(fieldId, seq);
    revokePendingUrl(fieldId);
    const previewUrl = URL.createObjectURL(file);
    pendingUrlsRef.current.set(fieldId, previewUrl);
    setPendingPreviews((current) => ({ ...current, [fieldId]: previewUrl }));
    setUploadingSlots((current) => ({ ...current, [fieldId]: true }));
    // Optimistic: the framed site shows the picked image instantly.
    send({ type: "cms:update-field", fieldId, value: previewUrl });

    uploadImageDraft(fieldId, file)
      .then(() => {
        if (seq !== uploadSeqRef.current.get(fieldId)) return; // a newer pick superseded this
        setUploadingSlots((current) => ({ ...current, [fieldId]: false }));
        showToast("Image saved as draft");
      })
      .catch((error) => {
        if (seq !== uploadSeqRef.current.get(fieldId)) return;
        setUploadingSlots((current) => ({ ...current, [fieldId]: false }));
        setImageErrors((current) => ({
          ...current,
          [fieldId]: "Upload failed — please try again.",
        }));
        revokePendingUrl(fieldId);
        setPendingPreviews((current) => {
          const next = { ...current };
          delete next[fieldId];
          return next;
        });
        if (previewFields[fieldId]) {
          send({ type: "cms:update-field", fieldId, value: previewFields[fieldId] });
        }
        console.error(error);
      });
  }

  function onImageDragOver(fieldId, event) {
    event.preventDefault();
    setDraggingSlots((current) => ({ ...current, [fieldId]: true }));
  }
  function onImageDragLeave(fieldId, event) {
    event.preventDefault();
    setDraggingSlots((current) => ({ ...current, [fieldId]: false }));
  }
  function onImageDrop(fieldId, event) {
    event.preventDefault();
    setDraggingSlots((current) => ({ ...current, [fieldId]: false }));
    const file = event.dataTransfer?.files?.[0];
    if (file) handleImageFile(fieldId, file);
  }

  function closeImageCard() {
    revokePendingUrl();
    setPendingPreviews({});
    setSelectedField(null);
    setImageErrors({});
    setDraggingSlots({});
    setUploadingSlots({});
    activeImageSlotRef.current = null;
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
  const selectedImageSlots = selectedImageField
    ? (
        Array.isArray(selectedImageField.slots) && selectedImageField.slots.length
          ? selectedImageField.slots
          : [{ name: "image", fieldId: selectedImageField.id, value: selectedImageField.value }]
      ).map((slot) => ({
        id: slot.fieldId,
        title: imageFieldTitle(slot.name ?? slot.fieldId),
        previewSrc:
          pendingPreviews[slot.fieldId] ||
          previewFields[slot.fieldId] ||
          slot.value ||
          null,
        isDraft: draftFieldIds.includes(slot.fieldId),
        isDragging: draggingSlots[slot.fieldId] === true,
        isUploading: uploadingSlots[slot.fieldId] === true,
        error: imageErrors[slot.fieldId] ?? null,
      }))
    : [];

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
      <Dock
        language={selectedLanguage}
        mode={mode}
        onLanguageChange={setSelectedLanguage}
        onModeChange={setMode}
        onSignOut={() => void signOut()}
        onThemeToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        theme={theme}
      />

      <PreviewFrame
        iframeRef={iframeRef}
        projectName={projectName}
        siteUrl={siteUrl}
        previewError={previewError}
      />

      <BottomBar
        changeCount={changeCount}
        onDiscard={onDiscard}
        onPublish={onPublish}
        pageName={pageName}
        projectName={projectName}
      />

      {selectedImageField && mode === "edit" && (
        <ImagePanel
          cardRef={imageCardRef}
          imageTitle={imageTitle}
          inputRef={imageInputRef}
          slots={selectedImageSlots}
          onChooseImage={onChooseImage}
          onClose={closeImageCard}
          onDragLeave={onImageDragLeave}
          onDragOver={onImageDragOver}
          onDrop={onImageDrop}
          onFileChange={onImageFileChange}
        />
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

      <EditorUx hint={hint} toast={toast} />
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<CmsApp />);
}
