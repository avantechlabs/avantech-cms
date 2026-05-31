import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useCmsProject } from "./hooks/useCmsProject.js";
import { useFieldManager } from "./hooks/useFieldManager.js";
import { useIframeMessaging } from "./hooks/useIframeMessaging.js";
import "./style.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

function getProjectSlug() {
  const [, first, second] = window.location.pathname.split("/");
  if (first === "cms" && second) return second;
  return first || "project-a";
}

function CmsApp() {
  if (!convexUrl) {
    return (
      <div className="missingConfig">
        <h1>Tiny CMS</h1>
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

  const { projects, project, previewFields, previewOrigin, siteUrl, ensureSeedData } =
    useCmsProject(projectSlug);

  const {
    fields,
    setFields,
    fieldValues,
    setFieldValues,
    selectedId,
    setSelectedId,
    saveState,
    seededSignatureRef,
    seedDiscoveredFields,
    saveDraftField,
    publish,
    resetForProject,
  } = useFieldManager(projectSlug);

  const { iframeRef, send } = useIframeMessaging({
    previewOrigin,
    projectSlug,
    onReady: () => send({ type: "cms:discover-fields" }),
    onFields: (nextFields) => {
      const editableFields = nextFields.filter((f) => f.editable !== false);
      setFields(editableFields);
      setSelectedId((current) => current || editableFields[0]?.id || null);

      const discoveredValues = Object.fromEntries(
        editableFields.map((f) => [f.id, f.value]),
      );
      setFieldValues((current) => ({ ...discoveredValues, ...current }));

      const signature = editableFields.map((f) => f.id).sort().join("|");
      if (signature && signature !== seededSignatureRef.current) {
        seededSignatureRef.current = signature;
        seedDiscoveredFields({
          projectSlug,
          pageSlug: "home",
          fields: editableFields.map((f) => ({ id: f.id, value: f.value })),
        }).then((seededFields) => {
          if (!seededFields) return;
          setFieldValues(seededFields);
          send({ type: "cms:apply-fields", fields: seededFields });
        });
      }
    },
    onFieldClicked: (fieldId) => {
      setSelectedId(fieldId);
      send({ type: "cms:select-field", fieldId });
    },
  });

  useEffect(() => {
    ensureSeedData();
  }, [ensureSeedData]);

  useEffect(() => {
    if (!previewFields) return;
    setFieldValues(previewFields);
    send({ type: "cms:apply-fields", fields: previewFields });
  }, [previewFields]);

  useEffect(() => {
    resetForProject();
  }, [projectSlug]);

  const selected = fields.find((f) => f.id === selectedId);
  const selectedValue = selectedId ? fieldValues[selectedId] ?? "" : "";

  function updateSelected(value) {
    if (!selectedId) return;
    saveDraftField(selectedId, value);
    send({ type: "cms:update-field", fieldId: selectedId, value });
  }
  return (
    <div className="app">
      <aside>
        <div className="sidebarTop">
          <div>
            <span className="eyebrow">Tiny CMS</span>
            <h1>{project?.name || projectSlug}</h1>
          </div>
          <button className="publishButton" onClick={publish} disabled={!project}>
            Publish
          </button>
        </div>

        <nav className="projectLinks" aria-label="Projects">
          {projects.map((item) => (
            <a
              key={item._id}
              href={`/cms/${item.slug}`}
              aria-current={item.slug === projectSlug ? "page" : undefined}
            >
              {item.name}
            </a>
          ))}
        </nav>

        <p className="meta">
          {fields.length} discovered fields · {saveState}
        </p>

        <div className="fieldList">
          {fields.map((field) => (
            <button
              key={field.id}
              aria-pressed={field.id === selectedId}
              onClick={() => {
                setSelectedId(field.id);
                send({ type: "cms:select-field", fieldId: field.id });
              }}
            >
              {field.id}
            </button>
          ))}
        </div>
        <label htmlFor="editor">Selected field</label>
        <textarea
          id="editor"
          disabled={!selected}
          value={selectedValue}
          onChange={(event) => updateSelected(event.target.value)}
        />
      </aside>

      <main>
        {siteUrl ? (
          <iframe ref={iframeRef} src={siteUrl} title={`${project.name} preview`} />
        ) : (
          <div className="emptyPreview">Loading project preview...</div>
        )}
        <div className="overlays">
          {fields.map((field) => (
            <button
              key={field.id}
              className={`handle${field.id === selectedId ? " active" : ""}`}
              style={{
                left: field.rect.left,
                top: field.rect.top,
                width: field.rect.width,
                height: field.rect.height,
              }}
              aria-label={field.id}
              onClick={() => {
                setSelectedId(field.id);
                send({ type: "cms:select-field", fieldId: field.id });
              }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<CmsApp />);
