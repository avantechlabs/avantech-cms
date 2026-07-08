import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireSiteAccess } from "./authz";
import { upsertPageContent } from "./pageContent";
import {
  clearCollectionDataForLanguage,
  collectionDataForLanguage,
  fieldsForLanguage,
  getContentForPage,
  getProject,
  hasMeaningfulCollectionDraft,
  languageOrDefault,
  languageValidator,
  listPagesForProject,
  mergeDraftOverPublished,
  publishedCollectionData,
  setCollectionDataForLanguage,
  setFieldsForLanguage,
} from "./shared";

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
