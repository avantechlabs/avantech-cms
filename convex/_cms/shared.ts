import { v } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export const HOME_PAGE_SLUG = "home";
export const DEFAULT_LANGUAGE = "fr";
export const STORAGE_REFERENCE_PREFIX = "convex-storage:";

export const SEEDED_PROJECTS = [
  {
    slug: "project-a",
    name: "Avantech",
    origin: "http://localhost:51731",
    editUrl: "http://localhost:51731",
  },
  {
    slug: "project-b",
    name: "Sable",
    origin: "http://localhost:51732",
    editUrl: "http://localhost:51732",
  },
];

// Demo collection records so the collections editor has something to render
// and click out of the box. Seeded as published; insert-if-missing so re-runs
// never clobber owner edits.
export const SEEDED_COLLECTIONS: Record<
  string,
  Record<string, { slug: string; data: unknown }[]>
> = {
  "project-b": {
    caseStudies: [
      {
        slug: "northgate-group",
        data: {
          title: "Northgate closes 3× faster",
          client: "Northgate Group",
          industry: "Finance",
          summary:
            "A 47-page supply agreement that used to take three weeks of email redlines now closes in two days, with every clause auditable.",
          cover: "/images/sable-contract-workspace.png",
          featured: true,
        },
      },
      {
        slug: "meridian-health",
        data: {
          title: "Meridian standardizes 200 contracts",
          client: "Meridian Health",
          industry: "Healthcare",
          summary:
            "Meridian's legal team rebuilt its clause library in Sable and brought 200 vendor contracts onto one approved standard.",
          cover: "/images/sable-contract-workspace.png",
          featured: false,
        },
      },
      {
        slug: "lumen-retail",
        data: {
          title: "Lumen cuts review time 70%",
          client: "Lumen Retail",
          industry: "Retail",
          summary:
            "Automated risk flagging let Lumen's two-person legal team keep pace with a fast-scaling store-rollout pipeline.",
          cover: "/images/sable-contract-workspace.png",
          featured: false,
        },
      },
    ],
  },
};

export const fieldsValidator = v.record(v.string(), v.string());
// optional language validator: 'fr' or 'en'
export const languageValidator = v.optional(
  v.union(v.literal("fr"), v.literal("en")),
);
export const collectionItemsValidator = v.array(
  v.object({
    slug: v.string(),
    data: v.any(),
  }),
);
export const pageDefinitionsValidator = v.array(
  v.object({
    slug: v.string(),
    title: v.string(),
    path: v.string(),
  }),
);
export const discoveredFieldsValidator = v.array(
  v.object({
    id: v.string(),
    value: v.string(),
  }),
);

export async function getProject(
  ctx: QueryCtx | MutationCtx,
  slug: string,
): Promise<Doc<"projects"> | null> {
  const project = await ctx.db
    .query("projects")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  return project;
}

export async function getPageForProject(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  pageSlug: string,
): Promise<Doc<"pages"> | null> {
  return await ctx.db
    .query("pages")
    .withIndex("by_projectId_and_slug", (q) =>
      q.eq("projectId", projectId).eq("slug", pageSlug),
    )
    .unique();
}

export async function getContentForPage(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  pageId: Id<"pages">,
): Promise<Doc<"pageContent"> | null> {
  return await ctx.db
    .query("pageContent")
    .withIndex("by_projectId_and_pageId", (q) =>
      q.eq("projectId", projectId).eq("pageId", pageId),
    )
    .unique();
}

export async function getSiteMember(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  email: string,
): Promise<Doc<"siteMembers"> | null> {
  return await ctx.db
    .query("siteMembers")
    .withIndex("by_projectId_and_email", (q) =>
      q.eq("projectId", projectId).eq("email", email),
    )
    .unique();
}

export async function listPagesForProject(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
): Promise<Doc<"pages">[]> {
  return await ctx.db
    .query("pages")
    .withIndex("by_projectId_and_slug", (q) => q.eq("projectId", projectId))
    .take(100);
}

export async function getCollectionItem(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  collectionKey: string,
  slug: string,
): Promise<Doc<"collectionItems"> | null> {
  return await ctx.db
    .query("collectionItems")
    .withIndex("by_projectId_and_collectionKey_and_slug", (q) =>
      q
        .eq("projectId", projectId)
        .eq("collectionKey", collectionKey)
        .eq("slug", slug),
    )
    .unique();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeProjectSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function setAtPath(
  source: unknown,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const keys = path.split(".").filter(Boolean);
  if (keys.length === 0)
    throw new Error("Collection draft path must not be empty.");
  if (keys.length === 0)
    throw new Error("Collection draft path must not be empty.");

  const root: Record<string, unknown> = isRecord(source) ? { ...source } : {};
  let cursor = root;
  for (const key of keys.slice(0, -1)) {
    const next = cursor[key];
    const nextRecord = isRecord(next) ? { ...next } : {};
    cursor[key] = nextRecord;
    cursor = nextRecord;
  }
  cursor[keys[keys.length - 1]] = value;

  return root;
}

export function mergeDraftOverPublished(
  published: unknown,
  draft: unknown,
): unknown {
  if (!isRecord(published) || !isRecord(draft)) return draft ?? published;

  const merged: Record<string, unknown> = { ...published };
  for (const [key, value] of Object.entries(draft)) {
    merged[key] = mergeDraftOverPublished(merged[key], value);
  }
  return merged;
}

export function valuesEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function languageOrDefault(language: string | undefined) {
  return language ?? DEFAULT_LANGUAGE;
}

export function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function requireNormalizedEmail(value: string) {
  const email = normalizeEmail(value);
  if (!email) throw new Error("Email is required.");
  return email;
}

export function fieldsForLanguage(
  fieldsByLanguage: Record<string, Record<string, string>> | undefined,
  language: string,
) {
  return fieldsByLanguage?.[language] ?? {};
}

export function setFieldsForLanguage(
  fieldsByLanguage: Record<string, Record<string, string>> | undefined,
  language: string,
  fields: Record<string, string>,
) {
  return {
    ...(fieldsByLanguage ?? {}),
    [language]: fields,
  };
}

export function collectionDataForLanguage(
  dataByLanguage: Record<string, unknown> | undefined,
  language: string,
) {
  if (!dataByLanguage) return undefined;
  return Object.prototype.hasOwnProperty.call(dataByLanguage, language)
    ? dataByLanguage[language]
    : undefined;
}

export function setCollectionDataForLanguage(
  dataByLanguage: Record<string, unknown> | undefined,
  language: string,
  data: unknown,
) {
  return {
    ...(dataByLanguage ?? {}),
    [language]: data,
  };
}

export function clearCollectionDataForLanguage(
  dataByLanguage: Record<string, unknown> | undefined,
  language: string,
) {
  const next = { ...(dataByLanguage ?? {}) };
  delete next[language];
  return next;
}

export function publishedCollectionData(
  item: Doc<"collectionItems">,
  language: string | undefined,
) {
  if (language === undefined) return item.publishedData;
  return (
    collectionDataForLanguage(item.publishedDataByLanguage, language) ??
    item.publishedData
  );
}

export function previewCollectionData(
  item: Doc<"collectionItems">,
  language: string | undefined,
) {
  if (language === undefined) {
    return mergeDraftOverPublished(item.publishedData, item.draftData);
  }

  return mergeDraftOverPublished(
    publishedCollectionData(item, language),
    collectionDataForLanguage(item.draftDataByLanguage, language),
  );
}

export function hasCollectionDraftChanges(
  item: Doc<"collectionItems">,
  language: string | undefined,
) {
  const draftData =
    language === undefined
      ? item.draftData
      : collectionDataForLanguage(item.draftDataByLanguage, language);
  if (draftData === undefined) return false;

  const publishedData = publishedCollectionData(item, language);
  return !valuesEqual(
    mergeDraftOverPublished(publishedData, draftData),
    publishedData,
  );
}
