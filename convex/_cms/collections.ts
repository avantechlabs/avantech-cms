import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin, requireSiteAccess } from "./authz";
import {
  clearCollectionDataForLanguage,
  collectionDataForLanguage,
  collectionItemsValidator,
  getCollectionItem,
  getProject,
  isRecord,
  languageOrDefault,
  languageValidator,
  mergeDraftOverPublished,
  publishedCollectionData,
  previewCollectionData,
  setAtPath,
  setCollectionDataForLanguage,
} from "./shared";
import { resolveStorageInValue } from "./storage";

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
