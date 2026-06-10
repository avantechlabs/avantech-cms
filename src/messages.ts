// postMessage contract between the CMS editor (parent) and the customer
// site running inside the iframe (where bridge.js lives).

export type ThemeTokens = Record<string, string>;

// parent (CMS) -> site (iframe / bridge.js)
export type CmsToSiteMessage =
  | { type: "cms:discover-fields" }
  | { type: "cms:apply-fields"; fields: Record<string, string> }
  | { type: "cms:update-field"; fieldId: string; value: string }
  | { type: "cms:select-field"; fieldId: string }
  | { type: "cms:enter-field"; fieldId: string }
  | { type: "cms:set-language"; language: "fr" | "en" }
  | { type: "cms:set-mode"; mode: "view" | "edit" }
  | { type: "cms:set-theme"; theme: "light" | "dark"; tokens: ThemeTokens }
  | { type: "cms:set-drafts"; fieldIds: string[] }
  | { type: "cms:set-draft-records"; records: { collectionKey: string; slug: string }[] };

export type FieldData = {
  id: string;
  kind?: "image" | "text" | "paragraph";
  value: string;
  editable?: boolean;
  rect: { left: number; top: number; width: number; height: number };
};

export type RecordRegionData = {
  collectionKey: string;
  itemSlug: string;
  rect: { left: number; top: number; width: number; height: number };
};

export type PageDefinition = {
  slug: string;
  title: string;
  path: string;
};

export type CollectionDefinition = {
  key: string;
  label: string;
  recordCount?: number;
  titlePath?: string;
  slugPath?: string;
  defaultItem?: unknown;
  groups?: unknown[];
  fields?: unknown[];
};

// site (iframe / bridge.js) -> parent (CMS)
export type SiteToCmsMessage =
  | { type: "cms:ready" }
  | { type: "cms:fields"; fields: FieldData[] }
  | { type: "cms:records"; records: RecordRegionData[] }
  | { type: "cms:pages"; pages: PageDefinition[] }
  | { type: "cms:collections"; collections: CollectionDefinition[] }
  | { type: "cms:field-clicked"; fieldId: string; kind?: FieldData["kind"] }
  | { type: "cms:record-clicked"; collectionKey: string; itemSlug: string }
  | { type: "cms:field-changed"; fieldId: string; value: string }
  | { type: "cms:editing"; fieldId: string | null };
