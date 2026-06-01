import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const HOME_PAGE_SLUG = "home";
const STORAGE_REFERENCE_PREFIX = "convex-storage:";

const SEEDED_PROJECTS = [
  {
    slug: "project-a",
    name: "Avantech",
    origin: "http://localhost:3001",
    editUrl: "http://localhost:3001",
  },
  {
    slug: "project-b",
    name: "Sable",
    origin: "http://localhost:3003",
    editUrl: "http://localhost:3003",
  },
];

const fieldsValidator = v.record(v.string(), v.string());
const collectionItemsValidator = v.array(
  v.object({
    slug: v.string(),
    data: v.any(),
  }),
);
const discoveredFieldsValidator = v.array(
  v.object({
    id: v.string(),
    value: v.string(),
  }),
);

async function getProject(
  ctx: QueryCtx | MutationCtx,
  slug: string,
): Promise<Doc<"projects"> | null> {
  return await ctx.db
    .query("projects")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

async function getPageForProject(
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

async function getContentForPage(
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

async function getCollectionItem(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  collectionKey: string,
  slug: string,
): Promise<Doc<"collectionItems"> | null> {
  return await ctx.db
    .query("collectionItems")
    .withIndex("by_projectId_and_collectionKey_and_slug", (q) =>
      q.eq("projectId", projectId).eq("collectionKey", collectionKey).eq("slug", slug),
    )
    .unique();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function setAtPath(source: unknown, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split(".").filter(Boolean);
  if (keys.length === 0) throw new Error("Collection draft path must not be empty.");

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

function mergeDraftOverPublished(published: unknown, draft: unknown): unknown {
  if (!isRecord(published) || !isRecord(draft)) return draft ?? published;

  const merged: Record<string, unknown> = { ...published };
  for (const [key, value] of Object.entries(draft)) {
    merged[key] = mergeDraftOverPublished(merged[key], value);
  }
  return merged;
}

function valuesEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function hasMeaningfulCollectionDraft(item: Doc<"collectionItems">) {
  if (item.draftData === undefined) return false;
  return !valuesEqual(
    mergeDraftOverPublished(item.publishedData, item.draftData),
    item.publishedData,
  );
}

function storageIdFromFieldValue(value: string): Id<"_storage"> | null {
  if (!value.startsWith(STORAGE_REFERENCE_PREFIX)) return null;

  const storageId = value.slice(STORAGE_REFERENCE_PREFIX.length);
  return storageId ? (storageId as Id<"_storage">) : null;
}

async function resolveStorageFieldValue(
  ctx: QueryCtx,
  value: string,
  cache: Map<string, string | null>,
) {
  const storageId = storageIdFromFieldValue(value);
  if (!storageId) return value;

  const cached = cache.get(storageId);
  if (cached !== undefined) return cached ?? value;

  try {
    const url = await ctx.storage.getUrl(storageId);
    cache.set(storageId, url);
    if (!url) {
      console.warn(`CMS storage reference could not be resolved: ${value}`);
    }
    return url ?? value;
  } catch (error) {
    cache.set(storageId, null);
    console.warn(`CMS storage reference could not be resolved: ${value}`, error);
    return value;
  }
}

async function resolveStorageFieldMap(
  ctx: QueryCtx,
  fields: Record<string, string>,
  cache = new Map<string, string | null>(),
) {
  const resolvedFields: Record<string, string> = {};
  await Promise.all(
    Object.entries(fields).map(async ([fieldId, value]) => {
      resolvedFields[fieldId] = await resolveStorageFieldValue(ctx, value, cache);
    }),
  );

  return resolvedFields;
}

async function resolveStorageInValue(
  ctx: QueryCtx,
  value: unknown,
  cache = new Map<string, string | null>(),
): Promise<unknown> {
  if (typeof value === "string") return await resolveStorageFieldValue(ctx, value, cache);
  if (Array.isArray(value)) {
    return await Promise.all(value.map((item) => resolveStorageInValue(ctx, item, cache)));
  }
  if (isRecord(value)) {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, nested]) => [
        key,
        await resolveStorageInValue(ctx, nested, cache),
      ]),
    );
    return Object.fromEntries(entries);
  }
  return value;
}

async function requireContent(
  ctx: QueryCtx | MutationCtx,
  projectSlug: string,
  pageSlug: string,
) {
  const project = await getProject(ctx, projectSlug);
  if (!project) return null;

  const page = await getPageForProject(ctx, project._id, pageSlug);
  if (!page) return null;

  const content = await getContentForPage(ctx, project._id, page._id);
  return { project, page, content };
}

async function upsertPageContent(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  pageId: Id<"pages">,
  existing: Doc<"pageContent"> | null,
  patch: {
    draftFields?: Record<string, string>;
    publishedFields?: Record<string, string>;
    lastSeenAt?: Record<string, number>;
    draftUpdatedAt?: number;
    publishedAt?: number;
  },
) {
  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, { ...patch, updatedAt: now });
  } else {
    await ctx.db.insert("pageContent", {
      projectId,
      pageId,
      draftFields: patch.draftFields ?? {},
      publishedFields: patch.publishedFields ?? {},
      updatedAt: now,
    });
  }
}

export const ensureSeedData = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    for (const seed of SEEDED_PROJECTS) {
      let project = await getProject(ctx, seed.slug);

      if (!project) {
        const projectId = await ctx.db.insert("projects", seed);
        project = { ...seed, _id: projectId, _creationTime: now };
      } else {
        await ctx.db.patch(project._id, {
          name: seed.name,
          origin: seed.origin,
          editUrl: seed.editUrl,
        });
      }

      let page = await getPageForProject(ctx, project._id, HOME_PAGE_SLUG);
      if (!page) {
        const pageId = await ctx.db.insert("pages", {
          projectId: project._id,
          slug: HOME_PAGE_SLUG,
          title: "Home",
        });
        page = {
          _id: pageId,
          _creationTime: now,
          projectId: project._id,
          slug: HOME_PAGE_SLUG,
          title: "Home",
        };
      }

      const content = await getContentForPage(ctx, project._id, page._id);
      if (!content) {
        await ctx.db.insert("pageContent", {
          projectId: project._id,
          pageId: page._id,
          draftFields: {},
          publishedFields: {},
          updatedAt: now,
        });
      }
    }

    return null;
  },
});

export const listProjects = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("projects").take(20);
  },
});

export const getProjectBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await getProject(ctx, args.slug);
  },
});

export const getPage = query({
  args: {
    projectSlug: v.string(),
    pageSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    if (!result) return null;
    const storageUrlCache = new Map<string, string | null>();

    return {
      project: result.project,
      page: result.page,
      draftFields: await resolveStorageFieldMap(
        ctx,
        result.content?.draftFields ?? {},
        storageUrlCache,
      ),
      publishedFields: await resolveStorageFieldMap(
        ctx,
        result.content?.publishedFields ?? {},
        storageUrlCache,
      ),
    };
  },
});

export const getPublishedContent = query({
  args: {
    projectSlug: v.string(),
    pageSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    return await resolveStorageFieldMap(
      ctx,
      result?.content?.publishedFields ?? {},
    );
  },
});

export const getPreviewContent = query({
  args: {
    projectSlug: v.string(),
    pageSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    if (!result?.content) return {};

    return await resolveStorageFieldMap(ctx, {
      ...result.content.publishedFields,
      ...result.content.draftFields,
    });
  },
});

export const seedPublishedCollectionItems = mutation({
  args: {
    projectSlug: v.string(),
    collectionKey: v.string(),
    items: collectionItemsValidator,
  },
  handler: async (ctx, args) => {
    const project = await getProject(ctx, args.projectSlug);
    if (!project) return null;

    const now = Date.now();
    const records = [];
    for (const item of args.items) {
      const existing = await getCollectionItem(
        ctx,
        project._id,
        args.collectionKey,
        item.slug,
      );
      if (existing) {
        await ctx.db.patch(existing._id, {
          publishedData: item.data,
          publishedAt: now,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("collectionItems", {
          projectId: project._id,
          collectionKey: args.collectionKey,
          slug: item.slug,
          publishedData: item.data,
          publishedAt: now,
          updatedAt: now,
        });
      }
      records.push({ slug: item.slug, data: item.data });
    }

    return records;
  },
});

export const listPublishedCollectionItems = query({
  args: {
    projectSlug: v.string(),
    collectionKey: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await getProject(ctx, args.projectSlug);
    if (!project) return [];

    const items = await ctx.db
      .query("collectionItems")
      .withIndex("by_projectId_and_collectionKey", (q) =>
        q.eq("projectId", project._id).eq("collectionKey", args.collectionKey),
      )
      .take(200);

    const storageUrlCache = new Map<string, string | null>();
    const publishedItems = items
      .filter((item) => item.publishedData !== undefined)
      .map((item) => ({
        slug: item.slug,
        data: item.publishedData,
      }));

    return await Promise.all(
      publishedItems.map(async (item) => ({
        slug: item.slug,
        data: await resolveStorageInValue(ctx, item.data, storageUrlCache),
      })),
    );
  },
});

export const createCollectionItemDraft = mutation({
  args: {
    projectSlug: v.string(),
    collectionKey: v.string(),
    slug: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const project = await getProject(ctx, args.projectSlug);
    if (!project) return null;

    const existing = await getCollectionItem(
      ctx,
      project._id,
      args.collectionKey,
      args.slug,
    );
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        draftData: args.data,
        draftUpdatedAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("collectionItems", {
        projectId: project._id,
        collectionKey: args.collectionKey,
        slug: args.slug,
        draftData: args.data,
        draftUpdatedAt: now,
        updatedAt: now,
      });
    }

    return { slug: args.slug, data: args.data };
  },
});

export const generateCollectionFileUploadUrl = mutation({
  args: {
    projectSlug: v.string(),
    collectionKey: v.string(),
    slug: v.string(),
    path: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await getProject(ctx, args.projectSlug);
    if (!project) return null;

    const item = await getCollectionItem(
      ctx,
      project._id,
      args.collectionKey,
      args.slug,
    );
    if (!item) return null;

    return await ctx.storage.generateUploadUrl();
  },
});

export const saveCollectionItemDraft = mutation({
  args: {
    projectSlug: v.string(),
    collectionKey: v.string(),
    slug: v.string(),
    path: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const project = await getProject(ctx, args.projectSlug);
    if (!project) return null;

    const item = await getCollectionItem(
      ctx,
      project._id,
      args.collectionKey,
      args.slug,
    );
    if (!item) return null;

    const draftData = setAtPath(item.draftData, args.path, args.value);
    await ctx.db.patch(item._id, {
      draftData,
      draftUpdatedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      slug: item.slug,
      data: mergeDraftOverPublished(item.publishedData, draftData),
    };
  },
});

export const listPreviewCollectionItems = query({
  args: {
    projectSlug: v.string(),
    collectionKey: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await getProject(ctx, args.projectSlug);
    if (!project) return [];

    const items = await ctx.db
      .query("collectionItems")
      .withIndex("by_projectId_and_collectionKey", (q) =>
        q.eq("projectId", project._id).eq("collectionKey", args.collectionKey),
      )
      .take(200);

    const storageUrlCache = new Map<string, string | null>();
    return await Promise.all(
      items.map(async (item) => ({
        slug: item.slug,
        data: await resolveStorageInValue(
          ctx,
          mergeDraftOverPublished(item.publishedData, item.draftData),
          storageUrlCache,
        ),
      })),
    );
  },
});

export const getSiteDraftState = query({
  args: {
    projectSlug: v.string(),
    pageSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    if (!result) {
      return {
        pageDraftFieldIds: [],
        collectionDrafts: [],
        collectionDraftCount: 0,
        totalDraftCount: 0,
      };
    }

    const draftFields = result.content?.draftFields ?? {};
    const publishedFields = result.content?.publishedFields ?? {};
    const pageDraftFieldIds = Object.keys(draftFields)
      .filter((fieldId) => draftFields[fieldId] !== publishedFields[fieldId])
      .sort();

    const collectionItems = await ctx.db
      .query("collectionItems")
      .withIndex("by_projectId", (q) => q.eq("projectId", result.project._id))
      .take(500);
    const collectionDrafts = collectionItems
      .filter(hasMeaningfulCollectionDraft)
      .map((item) => ({
        collectionKey: item.collectionKey,
        slug: item.slug,
      }))
      .sort((a, b) =>
        `${a.collectionKey}:${a.slug}`.localeCompare(`${b.collectionKey}:${b.slug}`),
      );

    return {
      pageDraftFieldIds,
      collectionDrafts,
      collectionDraftCount: collectionDrafts.length,
      totalDraftCount: pageDraftFieldIds.length + collectionDrafts.length,
    };
  },
});

export const publishSite = mutation({
  args: {
    projectSlug: v.string(),
    pageSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    if (!result) return null;

    const draftFields = result.content?.draftFields ?? {};
    const publishedFields = {
      ...(result.content?.publishedFields ?? {}),
      ...draftFields,
    };
    await upsertPageContent(ctx, result.project._id, result.page._id, result.content, {
      draftFields: {},
      publishedFields,
      publishedAt: Date.now(),
    });

    const collectionItems = await ctx.db
      .query("collectionItems")
      .withIndex("by_projectId", (q) => q.eq("projectId", result.project._id))
      .take(500);
    const now = Date.now();
    for (const item of collectionItems) {
      if (item.draftData === undefined) continue;
      await ctx.db.patch(item._id, {
        publishedData: mergeDraftOverPublished(item.publishedData, item.draftData),
        draftData: undefined,
        draftUpdatedAt: undefined,
        publishedAt: now,
        updatedAt: now,
      });
    }

    return null;
  },
});

export const discardSiteDrafts = mutation({
  args: {
    projectSlug: v.string(),
    pageSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    if (!result) return null;

    await upsertPageContent(ctx, result.project._id, result.page._id, result.content, {
      draftFields: {},
    });

    const collectionItems = await ctx.db
      .query("collectionItems")
      .withIndex("by_projectId", (q) => q.eq("projectId", result.project._id))
      .take(500);
    const now = Date.now();
    for (const item of collectionItems) {
      if (item.draftData === undefined) continue;
      if (item.publishedData === undefined) {
        await ctx.db.delete(item._id);
        continue;
      }
      await ctx.db.patch(item._id, {
        draftData: undefined,
        draftUpdatedAt: undefined,
        updatedAt: now,
      });
    }

    return null;
  },
});

export const seedDiscoveredFields = mutation({
  args: {
    projectSlug: v.string(),
    pageSlug: v.string(),
    fields: discoveredFieldsValidator,
  },
  handler: async (ctx, args) => {
    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    if (!result) return null;

    const content = result.content;
    const draftFields = { ...(content?.draftFields ?? {}) };
    const publishedFields = { ...(content?.publishedFields ?? {}) };
    const lastSeenAt = { ...(content?.lastSeenAt ?? {}) };

    const now = Date.now();
    let changed = !content; // create the row if it doesn't exist yet
    for (const field of args.fields) {
      if (!(field.id in publishedFields)) {
        publishedFields[field.id] = field.value;
        changed = true;
      }
      if (!(field.id in lastSeenAt)) {
        lastSeenAt[field.id] = now;
        changed = true;
      }
    }

    // Idempotent: re-discovering the same fields writes nothing, so reopening
    // the editor doesn't churn updatedAt / re-fire content subscriptions.
    if (changed) {
      await upsertPageContent(ctx, result.project._id, result.page._id, content, {
        publishedFields,
        lastSeenAt,
      });
    }

    return {
      ...publishedFields,
      ...draftFields,
    };
  },
});

export const generateImageUploadUrl = mutation({
  args: {
    projectSlug: v.string(),
    pageSlug: v.string(),
    fieldId: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    if (!result) return null;

    return await ctx.storage.generateUploadUrl();
  },
});

export const saveDraft = mutation({
  args: {
    projectSlug: v.string(),
    pageSlug: v.string(),
    fields: fieldsValidator,
  },
  handler: async (ctx, args) => {
    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    if (!result) return null;

    const nextDraftFields = {
      ...(result.content?.draftFields ?? {}),
      ...args.fields,
    };

    await upsertPageContent(ctx, result.project._id, result.page._id, result.content, {
      draftFields: nextDraftFields,
      draftUpdatedAt: Date.now(),
    });

    return nextDraftFields;
  },
});

export const publishPage = mutation({
  args: {
    projectSlug: v.string(),
    pageSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    if (!result) return null;

    const draftFields = result.content?.draftFields ?? {};
    const publishedFields = {
      ...(result.content?.publishedFields ?? {}),
      ...draftFields,
    };

    await upsertPageContent(ctx, result.project._id, result.page._id, result.content, {
      draftFields: {},
      publishedFields,
      publishedAt: Date.now(),
    });

    return publishedFields;
  },
});

export const discardDrafts = mutation({
  args: {
    projectSlug: v.string(),
    pageSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    if (!result?.content) return null;

    await ctx.db.patch(result.content._id, {
      draftFields: {},
      draftUpdatedAt: undefined,
      updatedAt: Date.now(),
    });

    return { ...result.content, draftFields: {}, draftUpdatedAt: undefined };
  },
});
