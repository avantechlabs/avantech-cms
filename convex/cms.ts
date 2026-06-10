import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const HOME_PAGE_SLUG = "home";
const DEFAULT_LANGUAGE = "fr";
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

// Demo collection records so the collections editor has something to render
// and click out of the box. Seeded as published; insert-if-missing so re-runs
// never clobber owner edits.
const SEEDED_COLLECTIONS: Record<string, Record<string, { slug: string; data: unknown }[]>> = {
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

const fieldsValidator = v.record(v.string(), v.string());
const languageValidator = v.optional(v.union(v.literal("fr"), v.literal("en")));
const collectionItemsValidator = v.array(
  v.object({
    slug: v.string(),
    data: v.any(),
  }),
);
const pageDefinitionsValidator = v.array(
  v.object({
    slug: v.string(),
    title: v.string(),
    path: v.string(),
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

async function getSiteMember(
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

async function listPagesForProject(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
): Promise<Doc<"pages">[]> {
  return await ctx.db
    .query("pages")
    .withIndex("by_projectId_and_slug", (q) => q.eq("projectId", projectId))
    .take(100);
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

function normalizeProjectSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function languageOrDefault(language: string | undefined) {
  return language ?? DEFAULT_LANGUAGE;
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function requireNormalizedEmail(value: string) {
  const email = normalizeEmail(value);
  if (!email) throw new Error("Email is required.");
  return email;
}

async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
}

async function getAuthenticatedEmail(ctx: QueryCtx | MutationCtx) {
  const identity = await requireIdentity(ctx);
  const identityEmail = normalizeEmail(identity.email);
  if (identityEmail) return identityEmail;

  const userId = await getAuthUserId(ctx);
  if (!userId) return "";

  const user = await ctx.db.get(userId);
  return normalizeEmail(user?.email);
}

async function isAdmin(ctx: QueryCtx | MutationCtx) {
  const adminEmail = normalizeEmail(process.env.CMS_ADMIN_EMAIL);
  if (!adminEmail) return false;

  return (await getAuthenticatedEmail(ctx)) === adminEmail;
}

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  await requireIdentity(ctx);
  if (!(await isAdmin(ctx))) throw new Error("Unauthorized");
}

async function requireSiteAccess(
  ctx: QueryCtx | MutationCtx,
  project: Doc<"projects"> | null,
) {
  if (!project) throw new Error("Project not found.");
  if (await isAdmin(ctx)) return project;

  const email = await getAuthenticatedEmail(ctx);
  if (!email) throw new Error("Unauthorized");

  const member = await getSiteMember(ctx, project._id, email);
  if (!member) throw new Error("Unauthorized");

  return project;
}

function fieldsForLanguage(
  fieldsByLanguage: Record<string, Record<string, string>> | undefined,
  language: string,
) {
  return fieldsByLanguage?.[language] ?? {};
}

function setFieldsForLanguage(
  fieldsByLanguage: Record<string, Record<string, string>> | undefined,
  language: string,
  fields: Record<string, string>,
) {
  return {
    ...(fieldsByLanguage ?? {}),
    [language]: fields,
  };
}

function collectionDataForLanguage(
  dataByLanguage: Record<string, unknown> | undefined,
  language: string,
) {
  if (!dataByLanguage) return undefined;
  return Object.prototype.hasOwnProperty.call(dataByLanguage, language)
    ? dataByLanguage[language]
    : undefined;
}

function setCollectionDataForLanguage(
  dataByLanguage: Record<string, unknown> | undefined,
  language: string,
  data: unknown,
) {
  return {
    ...(dataByLanguage ?? {}),
    [language]: data,
  };
}

function clearCollectionDataForLanguage(
  dataByLanguage: Record<string, unknown> | undefined,
  language: string,
) {
  const next = { ...(dataByLanguage ?? {}) };
  delete next[language];
  return next;
}

function publishedCollectionData(item: Doc<"collectionItems">, language: string | undefined) {
  if (language === undefined) return item.publishedData;
  return collectionDataForLanguage(item.publishedDataByLanguage, language) ?? item.publishedData;
}

function previewCollectionData(item: Doc<"collectionItems">, language: string | undefined) {
  if (language === undefined) {
    return mergeDraftOverPublished(item.publishedData, item.draftData);
  }

  return mergeDraftOverPublished(
    publishedCollectionData(item, language),
    collectionDataForLanguage(item.draftDataByLanguage, language),
  );
}

function hasMeaningfulCollectionDraft(
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

function storageIdFromFieldValue(value: string): Id<"_storage"> | null {
  if (!value.startsWith(STORAGE_REFERENCE_PREFIX)) return null;

  const storageId = value.slice(STORAGE_REFERENCE_PREFIX.length);
  return storageId ? (storageId as Id<"_storage">) : null;
}

async function resolveStorageFieldValue(
  ctx: QueryCtx | MutationCtx,
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
  ctx: QueryCtx | MutationCtx,
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

async function ensurePageContent(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  pageId: Id<"pages">,
) {
  const existing = await getContentForPage(ctx, projectId, pageId);
  if (existing) return existing;

  const now = Date.now();
  const contentId = await ctx.db.insert("pageContent", {
    projectId,
    pageId,
    draftFields: {},
    publishedFields: {},
    updatedAt: now,
  });
  return {
    _id: contentId,
    _creationTime: now,
    projectId,
    pageId,
    draftFields: {},
    publishedFields: {},
    updatedAt: now,
  };
}

async function upsertPageContent(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  pageId: Id<"pages">,
  existing: Doc<"pageContent"> | null,
  patch: {
    draftFields?: Record<string, string>;
    publishedFields?: Record<string, string>;
    draftFieldsByLanguage?: Record<string, Record<string, string>>;
    publishedFieldsByLanguage?: Record<string, Record<string, string>>;
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
          path: "/",
        });
        page = {
          _id: pageId,
          _creationTime: now,
          projectId: project._id,
          slug: HOME_PAGE_SLUG,
          title: "Home",
          path: "/",
        };
      } else if (!page.path) {
        await ctx.db.patch(page._id, { path: "/" });
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

      const seededCollections = SEEDED_COLLECTIONS[seed.slug];
      if (seededCollections) {
        for (const [collectionKey, items] of Object.entries(seededCollections)) {
          for (const item of items) {
            const existing = await getCollectionItem(ctx, project._id, collectionKey, item.slug);
            if (!existing) {
              await ctx.db.insert("collectionItems", {
                projectId: project._id,
                collectionKey,
                slug: item.slug,
                publishedData: item.data,
                publishedAt: now,
                updatedAt: now,
              });
            }
          }
        }
      }
    }

    return null;
  },
});

export const listProjects = query({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);

    const projects = await ctx.db.query("projects").take(100);
    if (await isAdmin(ctx)) {
      return projects.sort((a, b) => a.name.localeCompare(b.name));
    }

    const email = await getAuthenticatedEmail(ctx);
    if (!email) return [];

    const memberships = await ctx.db
      .query("siteMembers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .take(100);
    const allowedProjectIds = new Set(memberships.map((membership) => membership.projectId));

    return projects
      .filter((project) => allowedProjectIds.has(project._id))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const getCmsAccess = query({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    return { isAdmin: await isAdmin(ctx) };
  },
});

export const getProjectBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const project = await getProject(ctx, args.slug);
    await requireSiteAccess(ctx, project);
    return project;
  },
});

export const createProject = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    origin: v.string(),
    editUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const slug = normalizeProjectSlug(args.slug);
    const name = args.name.trim();
    const origin = args.origin.trim();
    const editUrl = args.editUrl.trim();

    if (!slug || !name || !origin || !editUrl) {
      throw new Error("Project fields are required.");
    }

    const existing = await getProject(ctx, slug);
    if (existing) throw new Error("Project slug already exists.");

    const projectId = await ctx.db.insert("projects", {
      slug,
      name,
      origin,
      editUrl,
    });
    const pageId = await ctx.db.insert("pages", {
      projectId,
      slug: HOME_PAGE_SLUG,
      title: "Home",
      path: "/",
    });
    await ctx.db.insert("pageContent", {
      projectId,
      pageId,
      draftFields: {},
      publishedFields: {},
      updatedAt: Date.now(),
    });

    return await ctx.db.get(projectId);
  },
});

export const updateProject = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    origin: v.string(),
    editUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const project = await getProject(ctx, args.slug);
    if (!project) throw new Error("Project not found.");

    const name = args.name.trim();
    const origin = args.origin.trim();
    const editUrl = args.editUrl.trim();
    if (!name || !origin || !editUrl) {
      throw new Error("Project fields are required.");
    }

    await ctx.db.patch(project._id, {
      name,
      origin,
      editUrl,
    });

    return await ctx.db.get(project._id);
  },
});

export const listSiteOwners = query({
  args: {
    projectSlug: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const project = await getProject(ctx, args.projectSlug);
    if (!project) return [];

    const owners = await ctx.db
      .query("siteMembers")
      .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
      .take(100);

    return owners.map((owner) => owner.email).sort();
  },
});

export const addSiteOwner = mutation({
  args: {
    projectSlug: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const project = await getProject(ctx, args.projectSlug);
    if (!project) throw new Error("Project not found.");

    const email = requireNormalizedEmail(args.email);
    const existing = await getSiteMember(ctx, project._id, email);
    if (existing) return email;

    await ctx.db.insert("siteMembers", {
      projectId: project._id,
      email,
      createdAt: Date.now(),
    });

    return email;
  },
});

export const removeSiteOwner = mutation({
  args: {
    projectSlug: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const project = await getProject(ctx, args.projectSlug);
    if (!project) return null;

    const email = requireNormalizedEmail(args.email);
    const existing = await getSiteMember(ctx, project._id, email);
    if (!existing) return null;

    await ctx.db.delete(existing._id);
    return email;
  },
});

export const syncPages = mutation({
  args: {
    projectSlug: v.string(),
    pages: pageDefinitionsValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const project = await getProject(ctx, args.projectSlug);
    if (!project) return [];

    const synced = [];
    for (const pageDefinition of args.pages) {
      const existing = await getPageForProject(
        ctx,
        project._id,
        pageDefinition.slug,
      );

      if (existing) {
        await ctx.db.patch(existing._id, {
          title: pageDefinition.title,
          path: pageDefinition.path,
        });
        await ensurePageContent(ctx, project._id, existing._id);
      } else {
        const pageId = await ctx.db.insert("pages", {
          projectId: project._id,
          slug: pageDefinition.slug,
          title: pageDefinition.title,
          path: pageDefinition.path,
        });
        await ensurePageContent(ctx, project._id, pageId);
      }

      synced.push({
        slug: pageDefinition.slug,
        title: pageDefinition.title,
        path: pageDefinition.path,
      });
    }

    return synced.sort((a, b) => a.title.localeCompare(b.title));
  },
});

export const listPages = query({
  args: {
    projectSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await getProject(ctx, args.projectSlug);
    if (!project) return [];
    await requireSiteAccess(ctx, project);

    const pages = await listPagesForProject(ctx, project._id);
    const result = [];
    for (const page of pages) {
      const content = await getContentForPage(ctx, project._id, page._id);
      const draftFields = content?.draftFields ?? {};
      const publishedFields = content?.publishedFields ?? {};
      const draftFieldIds = Object.keys(draftFields)
        .filter((fieldId) => draftFields[fieldId] !== publishedFields[fieldId])
        .sort();

      result.push({
        slug: page.slug,
        title: page.title,
        path: page.path ?? (page.slug === HOME_PAGE_SLUG ? "/" : `/${page.slug}`),
        draftFieldIds,
        draftCount: draftFieldIds.length,
      });
    }

    return result.sort((a, b) => {
      if (a.slug === HOME_PAGE_SLUG) return -1;
      if (b.slug === HOME_PAGE_SLUG) return 1;
      return a.title.localeCompare(b.title);
    });
  },
});

export const getPage = query({
  args: {
    projectSlug: v.string(),
    pageSlug: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    if (!result) return null;
    await requireSiteAccess(ctx, result.project);

    const storageUrlCache = new Map<string, string | null>();
    const language = languageOrDefault(args.language);
    const draftFields =
      args.language === undefined
        ? result.content?.draftFields ?? {}
        : fieldsForLanguage(result.content?.draftFieldsByLanguage, language);
    const publishedFields =
      args.language === undefined
        ? result.content?.publishedFields ?? {}
        : {
            ...(result.content?.publishedFields ?? {}),
            ...fieldsForLanguage(result.content?.publishedFieldsByLanguage, language),
          };

    return {
      project: result.project,
      page: result.page,
      language,
      draftFields: await resolveStorageFieldMap(
        ctx,
        draftFields,
        storageUrlCache,
      ),
      publishedFields: await resolveStorageFieldMap(
        ctx,
        publishedFields,
        storageUrlCache,
      ),
    };
  },
});

export const getPublishedContent = query({
  args: {
    projectSlug: v.string(),
    pageSlug: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    const language = languageOrDefault(args.language);
    const publishedFields =
      args.language === undefined
        ? result?.content?.publishedFields ?? {}
        : {
            ...(result?.content?.publishedFields ?? {}),
            ...fieldsForLanguage(result?.content?.publishedFieldsByLanguage, language),
          };
    return await resolveStorageFieldMap(
      ctx,
      publishedFields,
    );
  },
});

export const getPreviewContent = query({
  args: {
    projectSlug: v.string(),
    pageSlug: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    if (!result?.content) return {};
    await requireSiteAccess(ctx, result.project);

    const language = languageOrDefault(args.language);
    const publishedFields =
      args.language === undefined
        ? result.content.publishedFields
        : {
            ...result.content.publishedFields,
            ...fieldsForLanguage(result.content.publishedFieldsByLanguage, language),
          };
    const draftFields =
      args.language === undefined
        ? result.content.draftFields
        : fieldsForLanguage(result.content.draftFieldsByLanguage, language);

    return await resolveStorageFieldMap(ctx, {
      ...publishedFields,
      ...draftFields,
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
    await requireAdmin(ctx);

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
    language: languageValidator,
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
    const language = args.language === undefined ? undefined : languageOrDefault(args.language);
    const publishedItems = items
      .map((item) => ({
        item,
        data: publishedCollectionData(item, language),
      }))
      .filter(({ data }) => data !== undefined)
      .map((item) => ({
        slug: item.item.slug,
        data: item.data,
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
    language: languageValidator,
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const project = await getProject(ctx, args.projectSlug);
    if (!project) return null;
    await requireSiteAccess(ctx, project);

    const existing = await getCollectionItem(
      ctx,
      project._id,
      args.collectionKey,
      args.slug,
    );
    const now = Date.now();
    const language = args.language === undefined ? undefined : languageOrDefault(args.language);
    if (existing) {
      if (language === undefined) {
        await ctx.db.patch(existing._id, {
          draftData: args.data,
          draftUpdatedAt: now,
          updatedAt: now,
        });
      } else {
        await ctx.db.patch(existing._id, {
          draftDataByLanguage: setCollectionDataForLanguage(
            existing.draftDataByLanguage,
            language,
            args.data,
          ),
          draftUpdatedAt: now,
          updatedAt: now,
        });
      }
    } else {
      await ctx.db.insert("collectionItems", {
        projectId: project._id,
        collectionKey: args.collectionKey,
        slug: args.slug,
        ...(language === undefined
          ? { draftData: args.data }
          : {
              draftDataByLanguage: setCollectionDataForLanguage(
                undefined,
                language,
                args.data,
              ),
            }),
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
    await requireSiteAccess(ctx, project);

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
    language: languageValidator,
    path: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const project = await getProject(ctx, args.projectSlug);
    if (!project) return null;
    await requireSiteAccess(ctx, project);

    const item = await getCollectionItem(
      ctx,
      project._id,
      args.collectionKey,
      args.slug,
    );
    if (!item) return null;

    const language = args.language === undefined ? undefined : languageOrDefault(args.language);
    const now = Date.now();
    const draftData = setAtPath(
      language === undefined
        ? item.draftData
        : collectionDataForLanguage(item.draftDataByLanguage, language),
      args.path,
      args.value,
    );

    if (language === undefined) {
      await ctx.db.patch(item._id, {
        draftData,
        draftUpdatedAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(item._id, {
        draftDataByLanguage: setCollectionDataForLanguage(
          item.draftDataByLanguage,
          language,
          draftData,
        ),
        draftUpdatedAt: now,
        updatedAt: now,
      });
    }

    return {
      slug: item.slug,
      data: mergeDraftOverPublished(publishedCollectionData(item, language), draftData),
    };
  },
});

export const listPreviewCollectionItems = query({
  args: {
    projectSlug: v.string(),
    collectionKey: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const project = await getProject(ctx, args.projectSlug);
    if (!project) return [];
    await requireSiteAccess(ctx, project);

    const items = await ctx.db
      .query("collectionItems")
      .withIndex("by_projectId_and_collectionKey", (q) =>
        q.eq("projectId", project._id).eq("collectionKey", args.collectionKey),
      )
      .take(200);

    const storageUrlCache = new Map<string, string | null>();
    const language = args.language === undefined ? undefined : languageOrDefault(args.language);
    return await Promise.all(
      items.map(async (item) => ({
        slug: item.slug,
        data: await resolveStorageInValue(
          ctx,
          previewCollectionData(item, language),
          storageUrlCache,
        ),
      })),
    );
  },
});

export const getSiteDraftState = query({
  args: {
    projectSlug: v.string(),
    pageSlug: v.optional(v.string()),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const project = await getProject(ctx, args.projectSlug);
    if (!project) {
      return {
        pageDraftFieldIds: [],
        pageDrafts: [],
        collectionDrafts: [],
        collectionDraftCount: 0,
        totalDraftCount: 0,
      };
    }
    await requireSiteAccess(ctx, project);

    const pages = await listPagesForProject(ctx, project._id);
    const pageDrafts = [];
    let selectedPageDraftFieldIds: string[] = [];
    const language = languageOrDefault(args.language);
    for (const page of pages) {
      const content = await getContentForPage(ctx, project._id, page._id);
      const draftFields =
        args.language === undefined
          ? content?.draftFields ?? {}
          : fieldsForLanguage(content?.draftFieldsByLanguage, language);
      const publishedFields =
        args.language === undefined
          ? content?.publishedFields ?? {}
          : {
              ...(content?.publishedFields ?? {}),
              ...fieldsForLanguage(content?.publishedFieldsByLanguage, language),
            };
      const draftFieldIds = Object.keys(draftFields)
        .filter((fieldId) => draftFields[fieldId] !== publishedFields[fieldId])
        .sort();

      if (args.pageSlug && page.slug === args.pageSlug) {
        selectedPageDraftFieldIds = draftFieldIds;
      }
      if (draftFieldIds.length > 0) {
        pageDrafts.push({
          pageSlug: page.slug,
          fieldIds: draftFieldIds,
          draftCount: draftFieldIds.length,
        });
      }
    }

    const collectionItems = await ctx.db
      .query("collectionItems")
      .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
      .take(500);
    const collectionLanguage =
      args.language === undefined ? undefined : languageOrDefault(args.language);
    const collectionDrafts = collectionItems
      .filter((item) => hasMeaningfulCollectionDraft(item, collectionLanguage))
      .map((item) => ({
        collectionKey: item.collectionKey,
        slug: item.slug,
      }))
      .sort((a, b) =>
        `${a.collectionKey}:${a.slug}`.localeCompare(`${b.collectionKey}:${b.slug}`),
      );

    return {
      pageDraftFieldIds: selectedPageDraftFieldIds,
      pageDrafts: pageDrafts.sort((a, b) => a.pageSlug.localeCompare(b.pageSlug)),
      collectionDrafts,
      collectionDraftCount: collectionDrafts.length,
      totalDraftCount:
        pageDrafts.reduce((total, page) => total + page.draftCount, 0) +
        collectionDrafts.length,
    };
  },
});

export const publishSite = mutation({
  args: {
    projectSlug: v.string(),
    pageSlug: v.optional(v.string()),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const project = await getProject(ctx, args.projectSlug);
    if (!project) return null;
    await requireSiteAccess(ctx, project);

    const pages = await listPagesForProject(ctx, project._id);
    const now = Date.now();
    const language = languageOrDefault(args.language);
    for (const page of pages) {
      const content = await getContentForPage(ctx, project._id, page._id);
      if (args.language === undefined) {
        const draftFields = content?.draftFields ?? {};
        const publishedFields = {
          ...(content?.publishedFields ?? {}),
          ...draftFields,
        };
        await upsertPageContent(ctx, project._id, page._id, content, {
          draftFields: {},
          publishedFields,
          publishedAt: now,
        });
      } else {
        const draftFields = fieldsForLanguage(content?.draftFieldsByLanguage, language);
        const publishedFields = {
          ...fieldsForLanguage(content?.publishedFieldsByLanguage, language),
          ...draftFields,
        };
        await upsertPageContent(ctx, project._id, page._id, content, {
          draftFieldsByLanguage: setFieldsForLanguage(
            content?.draftFieldsByLanguage,
            language,
            {},
          ),
          publishedFieldsByLanguage: setFieldsForLanguage(
            content?.publishedFieldsByLanguage,
            language,
            publishedFields,
          ),
          publishedAt: now,
        });
      }
    }

    const collectionItems = await ctx.db
      .query("collectionItems")
      .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
      .take(500);
    for (const item of collectionItems) {
      if (args.language === undefined) {
        if (item.draftData === undefined) continue;
        await ctx.db.patch(item._id, {
          publishedData: mergeDraftOverPublished(item.publishedData, item.draftData),
          draftData: undefined,
          draftUpdatedAt: undefined,
          publishedAt: now,
          updatedAt: now,
        });
      } else {
        const draftData = collectionDataForLanguage(item.draftDataByLanguage, language);
        if (draftData === undefined) continue;

        await ctx.db.patch(item._id, {
          publishedDataByLanguage: setCollectionDataForLanguage(
            item.publishedDataByLanguage,
            language,
            mergeDraftOverPublished(publishedCollectionData(item, language), draftData),
          ),
          draftDataByLanguage: clearCollectionDataForLanguage(
            item.draftDataByLanguage,
            language,
          ),
          draftUpdatedAt: undefined,
          publishedAt: now,
          updatedAt: now,
        });
      }
    }

    return null;
  },
});

export const discardSiteDrafts = mutation({
  args: {
    projectSlug: v.string(),
    pageSlug: v.optional(v.string()),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const project = await getProject(ctx, args.projectSlug);
    if (!project) return null;
    await requireSiteAccess(ctx, project);

    const pages = await listPagesForProject(ctx, project._id);
    const language = languageOrDefault(args.language);
    for (const page of pages) {
      const content = await getContentForPage(ctx, project._id, page._id);
      if (!content) continue;
      if (args.language === undefined) {
        await upsertPageContent(ctx, project._id, page._id, content, {
          draftFields: {},
        });
      } else {
        await upsertPageContent(ctx, project._id, page._id, content, {
          draftFieldsByLanguage: setFieldsForLanguage(
            content.draftFieldsByLanguage,
            language,
            {},
          ),
        });
      }
    }

    const collectionItems = await ctx.db
      .query("collectionItems")
      .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
      .take(500);
    const now = Date.now();
    for (const item of collectionItems) {
      if (args.language === undefined) {
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
      } else {
        const draftData = collectionDataForLanguage(item.draftDataByLanguage, language);
        if (draftData === undefined) continue;

        const nextDraftDataByLanguage = clearCollectionDataForLanguage(
          item.draftDataByLanguage,
          language,
        );
        if (
          item.publishedData === undefined &&
          Object.keys(item.publishedDataByLanguage ?? {}).length === 0 &&
          item.draftData === undefined &&
          Object.keys(nextDraftDataByLanguage).length === 0
        ) {
          await ctx.db.delete(item._id);
          continue;
        }
        await ctx.db.patch(item._id, {
          draftDataByLanguage: nextDraftDataByLanguage,
          draftUpdatedAt: undefined,
          updatedAt: now,
        });
      }
    }

    return null;
  },
});

export const seedDiscoveredFields = mutation({
  args: {
    projectSlug: v.string(),
    pageSlug: v.string(),
    language: languageValidator,
    fields: discoveredFieldsValidator,
  },
  handler: async (ctx, args) => {
    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    if (!result) return null;

    const content = result.content;
    const language = languageOrDefault(args.language);
    const draftFields =
      args.language === undefined
        ? { ...(content?.draftFields ?? {}) }
        : {
            ...fieldsForLanguage(content?.draftFieldsByLanguage, language),
          };
    const publishedFields =
      args.language === undefined
        ? { ...(content?.publishedFields ?? {}) }
        : {
            ...fieldsForLanguage(content?.publishedFieldsByLanguage, language),
          };
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
      if (args.language === undefined) {
        await upsertPageContent(ctx, result.project._id, result.page._id, content, {
          publishedFields,
          lastSeenAt,
        });
      } else {
        await upsertPageContent(ctx, result.project._id, result.page._id, content, {
          publishedFieldsByLanguage: setFieldsForLanguage(
            content?.publishedFieldsByLanguage,
            language,
            publishedFields,
          ),
          lastSeenAt,
        });
      }
    }

    return await resolveStorageFieldMap(ctx, {
      ...publishedFields,
      ...draftFields,
    });
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
    await requireSiteAccess(ctx, result.project);

    return await ctx.storage.generateUploadUrl();
  },
});

export const saveDraft = mutation({
  args: {
    projectSlug: v.string(),
    pageSlug: v.string(),
    language: languageValidator,
    fields: fieldsValidator,
  },
  handler: async (ctx, args) => {
    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    if (!result) return null;
    await requireSiteAccess(ctx, result.project);

    const existingDraftFields =
      args.language === undefined
        ? result.content?.draftFields ?? {}
        : fieldsForLanguage(
            result.content?.draftFieldsByLanguage,
            languageOrDefault(args.language),
          );
    const nextDraftFields = { ...existingDraftFields, ...args.fields };

    if (args.language === undefined) {
      await upsertPageContent(ctx, result.project._id, result.page._id, result.content, {
        draftFields: nextDraftFields,
        draftUpdatedAt: Date.now(),
      });
    } else {
      const language = languageOrDefault(args.language);
      await upsertPageContent(ctx, result.project._id, result.page._id, result.content, {
        draftFieldsByLanguage: setFieldsForLanguage(
          result.content?.draftFieldsByLanguage,
          language,
          nextDraftFields,
        ),
        draftUpdatedAt: Date.now(),
      });
    }

    return nextDraftFields;
  },
});

export const publishPage = mutation({
  args: {
    projectSlug: v.string(),
    pageSlug: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    if (!result) return null;
    await requireSiteAccess(ctx, result.project);

    const language = languageOrDefault(args.language);
    const draftFields =
      args.language === undefined
        ? result.content?.draftFields ?? {}
        : fieldsForLanguage(result.content?.draftFieldsByLanguage, language);
    const existingPublishedFields =
      args.language === undefined
        ? result.content?.publishedFields ?? {}
        : fieldsForLanguage(result.content?.publishedFieldsByLanguage, language);
    const publishedFields = { ...existingPublishedFields, ...draftFields };

    if (args.language === undefined) {
      await upsertPageContent(ctx, result.project._id, result.page._id, result.content, {
        draftFields: {},
        publishedFields,
        publishedAt: Date.now(),
      });
    } else {
      await upsertPageContent(ctx, result.project._id, result.page._id, result.content, {
        draftFieldsByLanguage: setFieldsForLanguage(
          result.content?.draftFieldsByLanguage,
          language,
          {},
        ),
        publishedFieldsByLanguage: setFieldsForLanguage(
          result.content?.publishedFieldsByLanguage,
          language,
          publishedFields,
        ),
        publishedAt: Date.now(),
      });
    }

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
    await requireSiteAccess(ctx, result.project);

    await ctx.db.patch(result.content._id, {
      draftFields: {},
      draftUpdatedAt: undefined,
      updatedAt: Date.now(),
    });

    return { ...result.content, draftFields: {}, draftUpdatedAt: undefined };
  },
});
