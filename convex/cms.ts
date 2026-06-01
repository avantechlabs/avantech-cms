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
