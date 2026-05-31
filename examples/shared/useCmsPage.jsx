import { createContext, useContext, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";

const FIELD_SELECTOR = "[data-cms-field]";
const PUBLISHED_CONTENT_QUERY = "cms:getPublishedContent";
const CmsContentContext = createContext(null);

function isEditMode() {
  return new URLSearchParams(location.search).get("edit") === "1";
}

function isEditableField(element) {
  return !element.querySelector(FIELD_SELECTOR);
}

function getEditableFields() {
  return [...document.querySelectorAll(FIELD_SELECTOR)].filter(isEditableField);
}

function getEditableField(fieldId) {
  const el = document.querySelector(`[data-cms-field="${fieldId}"]`);
  if (!el || !isEditableField(el)) return null;
  return el;
}

export function useEditBridge() {
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("edit") !== "1") return;
    if (document.querySelector('script[data-cms-bridge="true"]')) return;

    const script = document.createElement("script");
    script.src = "/bridge.js";
    script.dataset.cmsBridge = "true";
    document.body.append(script);
  }, []);
}

export function useCmsPage(projectSlug, pageSlug) {
  const publishedFields = useQuery(PUBLISHED_CONTENT_QUERY, {
    projectSlug,
    pageSlug,
  });

  useEffect(() => {
    if (!publishedFields || isEditMode()) return;

    for (const el of getEditableFields()) {
      const fieldId = el.dataset.cmsField;
      if (!Object.prototype.hasOwnProperty.call(publishedFields, fieldId)) {
        throw new Error(`Missing published CMS value for ${projectSlug}/${pageSlug}:${fieldId}`);
      }
    }

    for (const [fieldId, value] of Object.entries(publishedFields)) {
      const el = getEditableField(fieldId);
      if (el) el.textContent = value;
    }
  }, [publishedFields, projectSlug, pageSlug]);

  return publishedFields ?? {};
}

export function CmsContentProvider({
  projectSlug,
  pageSlug,
  mode = "public",
  children,
}) {
  const publishedFields = useQuery(PUBLISHED_CONTENT_QUERY, {
    projectSlug,
    pageSlug,
  });

  const value = useMemo(
    () => ({
      fields: publishedFields,
      isLoaded: publishedFields !== undefined,
      mode,
      pageSlug,
      projectSlug,
    }),
    [publishedFields, mode, pageSlug, projectSlug],
  );

  return (
    <CmsContentContext.Provider value={value}>
      {children}
    </CmsContentContext.Provider>
  );
}

export function CmsText({ fieldId, children }) {
  const cms = useContext(CmsContentContext);

  if (!cms || isEditMode() || !cms.isLoaded) return children;

  if (!Object.prototype.hasOwnProperty.call(cms.fields, fieldId)) {
    throw new Error(`Missing published CMS value for ${cms.projectSlug}/${cms.pageSlug}:${fieldId}`);
  }

  return cms.fields[fieldId];
}
