import { createContext, useContext, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";

const FIELD_SELECTOR = "[data-cms-field]";
const PUBLISHED_CONTENT_QUERY = "cms:getPublishedContent";
const PUBLISHED_COLLECTION_QUERY = "cms:listPublishedCollectionItems";
const PREVIEW_COLLECTION_QUERY = "cms:listPreviewCollectionItems";
const COLLECTIONS_REGISTRY = "__AVANTECH_CMS_COLLECTIONS__";
const PAGES_REGISTRY = "__AVANTECH_CMS_PAGES__";
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

function getFieldValue(cms, fieldId) {
  if (!Object.prototype.hasOwnProperty.call(cms.fields, fieldId)) {
    throw new Error(`Missing published CMS value for ${cms.projectSlug}/${cms.pageSlug}:${fieldId}`);
  }

  return cms.fields[fieldId];
}

function applyValueToField(el, value) {
  if (el instanceof HTMLImageElement) {
    el.src = value;
  } else {
    el.textContent = value;
  }
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

export function useCmsPage(projectSlug, pageSlug, language = "fr") {
  const publishedFields = useQuery(PUBLISHED_CONTENT_QUERY, {
    projectSlug,
    pageSlug,
    language,
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
      if (el) applyValueToField(el, value);
    }
  }, [publishedFields, projectSlug, pageSlug]);

  return publishedFields ?? {};
}

export function useCmsCollection(projectSlug, collectionKey) {
  const query = isEditMode() ? PREVIEW_COLLECTION_QUERY : PUBLISHED_COLLECTION_QUERY;
  return useQuery(query, {
    projectSlug,
    collectionKey,
  }) ?? [];
}

export function CmsContentProvider({
  projectSlug,
  pageSlug,
  language = "fr",
  mode = "public",
  children,
}) {
  const publishedFields = useQuery(PUBLISHED_CONTENT_QUERY, {
    projectSlug,
    pageSlug,
    language,
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

function toSerializableCollections(collections) {
  return JSON.parse(JSON.stringify(collections ?? []));
}

export function CmsCollectionsProvider({ collections = [], children }) {
  const serializableCollections = useMemo(
    () => toSerializableCollections(collections),
    [collections],
  );

  useEffect(() => {
    window[COLLECTIONS_REGISTRY] = serializableCollections;
    window.dispatchEvent(
      new CustomEvent("cms:collections-changed", {
        detail: serializableCollections,
      }),
    );

    return () => {
      if (window[COLLECTIONS_REGISTRY] === serializableCollections) {
        delete window[COLLECTIONS_REGISTRY];
      }
    };
  }, [serializableCollections]);

  return children;
}

export function CmsPagesProvider({ pages = [], children }) {
  const serializablePages = useMemo(
    () => JSON.parse(JSON.stringify(pages ?? [])),
    [pages],
  );

  useEffect(() => {
    window[PAGES_REGISTRY] = serializablePages;
    window.dispatchEvent(
      new CustomEvent("cms:pages-changed", {
        detail: serializablePages,
      }),
    );

    return () => {
      if (window[PAGES_REGISTRY] === serializablePages) {
        delete window[PAGES_REGISTRY];
      }
    };
  }, [serializablePages]);

  return children;
}

export function CmsText({ fieldId, children }) {
  const cms = useContext(CmsContentContext);

  if (!cms || isEditMode() || !cms.isLoaded) return children;

  return getFieldValue(cms, fieldId);
}

export function CmsImage({ fieldId, src, alt = "", ...props }) {
  const cms = useContext(CmsContentContext);
  const renderedSrc = !cms || isEditMode() || !cms.isLoaded
    ? src
    : getFieldValue(cms, fieldId);

  return (
    <img
      {...props}
      alt={alt}
      data-cms-field={fieldId}
      src={renderedSrc}
    />
  );
}
