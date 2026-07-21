import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireAdmin, requireSiteAccess } from "./authz";
import {
  discoveredFieldsValidator,
  fieldsForLanguage,
  fieldsValidator,
  getContentForPage,
  getPageForProject,
  getProject,
  HOME_PAGE_SLUG,
  languageOrDefault,
  languageValidator,
  listPagesForProject,
  pageDefinitionsValidator,
  setFieldsForLanguage,
} from "./shared";
import { resolveStorageFieldMap } from "./storage";

export async function requireContent(
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

export async function ensurePageContent(
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

export async function upsertPageContent(
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
    const result = await requireContent(ctx, args.projectSlug, args.pageSlug);
    if (!result) return null;
    await requireSiteAccess(ctx, result.project);

    const storageUrlCache = new Map<string, string | null>();
    const language = languageOrDefault(args.language);
    const draftFields =
      args.language === undefined
        ? result.content?.draftFields ?? {}
        : {
            ...(result.content?.draftFields ?? {}),
            ...fieldsForLanguage(result.content?.draftFieldsByLanguage, language),
          };
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
        : {
            ...result.content.draftFields,
            ...fieldsForLanguage(result.content.draftFieldsByLanguage, language),
          };

    return await resolveStorageFieldMap(ctx, {
      ...publishedFields,
      ...draftFields,
    });
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
    await requireAdmin(ctx);

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
        : {
            ...(result.content?.draftFields ?? {}),
            ...fieldsForLanguage(result.content?.draftFieldsByLanguage, language),
          };
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
      const globalDraftFields = result.content?.draftFields ?? {};
      const languageDraftFields = fieldsForLanguage(
        result.content?.draftFieldsByLanguage,
        language,
      );
      const publishedGlobalFields = {
        ...(result.content?.publishedFields ?? {}),
        ...globalDraftFields,
      };
      const publishedLanguageFields = {
        ...existingPublishedFields,
        ...languageDraftFields,
      };
      await upsertPageContent(ctx, result.project._id, result.page._id, result.content, {
        draftFields: {},
        publishedFields: publishedGlobalFields,
        draftFieldsByLanguage: setFieldsForLanguage(
          result.content?.draftFieldsByLanguage,
          language,
          {},
        ),
        publishedFieldsByLanguage: setFieldsForLanguage(
          result.content?.publishedFieldsByLanguage,
          language,
          publishedLanguageFields,
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
