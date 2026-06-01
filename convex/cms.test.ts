/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import type { TestConvex } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const projectSlug = "project-a";
const pageSlug = "home";
type CmsTest = TestConvex<typeof schema>;

async function storeImage(t: CmsTest, contents: string) {
  return await t.run(async (ctx) => {
    return await ctx.storage.store(new Blob([contents], { type: "image/png" }));
  });
}

async function getStoredPageContent(t: CmsTest) {
  return await t.run(async (ctx) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_slug", (q) => q.eq("slug", projectSlug))
      .unique();
    if (!project) throw new Error("Expected seeded project");

    const page = await ctx.db
      .query("pages")
      .withIndex("by_projectId_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", pageSlug),
      )
      .unique();
    if (!page) throw new Error("Expected seeded page");

    const content = await ctx.db
      .query("pageContent")
      .withIndex("by_projectId_and_pageId", (q) =>
        q.eq("projectId", project._id).eq("pageId", page._id),
      )
      .unique();
    if (!content) throw new Error("Expected seeded page content");

    return content;
  });
}

test("public content reads resolve canonical Convex storage references", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  const storageId = await storeImage(t, "published image");
  const canonicalValue = `convex-storage:${storageId}`;

  await t.mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": canonicalValue },
  });
  const publishedFromMutation = await t.mutation(api.cms.publishPage, {
    projectSlug,
    pageSlug,
  });

  const publicFields = await t.query(api.cms.getPublishedContent, {
    projectSlug,
    pageSlug,
  });
  const storedContent = await getStoredPageContent(t);

  expect(publishedFromMutation?.["hero.image"]).toBe(canonicalValue);
  expect(storedContent.publishedFields["hero.image"]).toBe(canonicalValue);
  expect(publicFields["hero.image"]).not.toBe(canonicalValue);
  expect(publicFields["hero.image"]).toMatch(
    /^https:\/\/some-deployment\.convex\.cloud\/api\/storage\//,
  );
});

test("preview content resolves the draft image after draft-over-published merge", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  const publishedStorageId = await storeImage(t, "published image");
  const draftStorageId = await storeImage(t, "draft image");
  const publishedCanonicalValue = `convex-storage:${publishedStorageId}`;
  const draftCanonicalValue = `convex-storage:${draftStorageId}`;

  await t.mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": publishedCanonicalValue },
  });
  await t.mutation(api.cms.publishPage, { projectSlug, pageSlug });
  await t.mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": draftCanonicalValue },
  });

  const draftUrl = await t.run(async (ctx) => {
    return await ctx.storage.getUrl(draftStorageId);
  });
  const previewFields = await t.query(api.cms.getPreviewContent, {
    projectSlug,
    pageSlug,
  });
  const storedContent = await getStoredPageContent(t);

  expect(storedContent.publishedFields["hero.image"]).toBe(publishedCanonicalValue);
  expect(storedContent.draftFields["hero.image"]).toBe(draftCanonicalValue);
  expect(previewFields["hero.image"]).toBe(draftUrl);
});

test("non-storage URL values pass through content reads unchanged", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  const urlFields = {
    "image.static": "/assets/hero.png",
    "image.relative": "images/hero.png",
    "image.absolute": "https://example.com/hero.png",
    "image.external": "//cdn.example.com/hero.png",
  };

  await t.mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: urlFields,
  });
  await t.mutation(api.cms.publishPage, { projectSlug, pageSlug });

  const publicFields = await t.query(api.cms.getPublishedContent, {
    projectSlug,
    pageSlug,
  });
  const previewFields = await t.query(api.cms.getPreviewContent, {
    projectSlug,
    pageSlug,
  });

  expect(publicFields).toMatchObject(urlFields);
  expect(previewFields).toMatchObject(urlFields);
});

test("image discovery seeds only missing published values without replacing drafts", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  const firstSeed = await t.mutation(api.cms.seedDiscoveredFields, {
    projectSlug,
    pageSlug,
    fields: [{ id: "hero.image", value: "/images/static-hero.jpg" }],
  });

  await t.mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": "/images/draft-hero.jpg" },
  });

  const secondSeed = await t.mutation(api.cms.seedDiscoveredFields, {
    projectSlug,
    pageSlug,
    fields: [{ id: "hero.image", value: "/images/changed-static-hero.jpg" }],
  });
  const storedContent = await getStoredPageContent(t);

  expect(firstSeed?.["hero.image"]).toBe("/images/static-hero.jpg");
  expect(secondSeed?.["hero.image"]).toBe("/images/draft-hero.jpg");
  expect(storedContent.publishedFields["hero.image"]).toBe("/images/static-hero.jpg");
  expect(storedContent.draftFields["hero.image"]).toBe("/images/draft-hero.jpg");
});

test("image upload flow saves a canonical draft while public output stays published", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  const publishedStorageId = await storeImage(t, "published image");
  const draftStorageId = await storeImage(t, "draft image");
  const publishedCanonicalValue = `convex-storage:${publishedStorageId}`;
  const draftCanonicalValue = `convex-storage:${draftStorageId}`;

  await t.mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": publishedCanonicalValue },
  });
  await t.mutation(api.cms.publishPage, { projectSlug, pageSlug });

  const uploadUrl = await t.mutation(api.cms.generateImageUploadUrl, {
    projectSlug,
    pageSlug,
    fieldId: "hero.image",
  });
  await t.mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": draftCanonicalValue },
  });

  const storedContent = await getStoredPageContent(t);
  const publicFields = await t.query(api.cms.getPublishedContent, {
    projectSlug,
    pageSlug,
  });
  const previewFields = await t.query(api.cms.getPreviewContent, {
    projectSlug,
    pageSlug,
  });
  const publishedUrl = await t.run(async (ctx) => {
    return await ctx.storage.getUrl(publishedStorageId);
  });
  const draftUrl = await t.run(async (ctx) => {
    return await ctx.storage.getUrl(draftStorageId);
  });

  expect(uploadUrl).toMatch(/^https:\/\/some-deployment\.convex\.cloud\/api\/storage\/upload\?token=/);
  expect(storedContent.draftFields["hero.image"]).toBe(draftCanonicalValue);
  expect(storedContent.publishedFields["hero.image"]).toBe(publishedCanonicalValue);
  expect(publicFields["hero.image"]).toBe(publishedUrl);
  expect(previewFields["hero.image"]).toBe(draftUrl);
});

test("image draft uploads are isolated by project slug and page slug", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  await t.mutation(api.cms.seedDiscoveredFields, {
    projectSlug: "project-a",
    pageSlug,
    fields: [{ id: "hero.image", value: "/project-a-published.jpg" }],
  });
  await t.mutation(api.cms.seedDiscoveredFields, {
    projectSlug: "project-b",
    pageSlug,
    fields: [{ id: "hero.image", value: "/project-b-published.jpg" }],
  });
  await t.mutation(api.cms.saveDraft, {
    projectSlug: "project-a",
    pageSlug,
    fields: { "hero.image": "convex-storage:project-a-draft" },
  });

  const projectA = await t.query(api.cms.getPreviewContent, {
    projectSlug: "project-a",
    pageSlug,
  });
  const projectB = await t.query(api.cms.getPreviewContent, {
    projectSlug: "project-b",
    pageSlug,
  });

  expect(projectA["hero.image"]).toBe("convex-storage:project-a-draft");
  expect(projectB["hero.image"]).toBe("/project-b-published.jpg");
});

test("publishing an image draft promotes it to published content and clears drafts", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  const originalStorageId = await storeImage(t, "original image");
  const draftStorageId = await storeImage(t, "replacement image");
  const originalCanonicalValue = `convex-storage:${originalStorageId}`;
  const draftCanonicalValue = `convex-storage:${draftStorageId}`;

  await t.mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": originalCanonicalValue },
  });
  await t.mutation(api.cms.publishPage, { projectSlug, pageSlug });
  await t.mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": draftCanonicalValue },
  });

  const pageWithDraft = await t.query(api.cms.getPage, { projectSlug, pageSlug });
  const publishedFields = await t.mutation(api.cms.publishPage, {
    projectSlug,
    pageSlug,
  });
  const storedContent = await getStoredPageContent(t);
  const pageAfterPublish = await t.query(api.cms.getPage, { projectSlug, pageSlug });
  const publicFields = await t.query(api.cms.getPublishedContent, {
    projectSlug,
    pageSlug,
  });
  const draftUrl = await t.run(async (ctx) => {
    return await ctx.storage.getUrl(draftStorageId);
  });

  expect(pageWithDraft?.draftFields["hero.image"]).toBe(draftUrl);
  expect(publishedFields?.["hero.image"]).toBe(draftCanonicalValue);
  expect(storedContent.publishedFields["hero.image"]).toBe(draftCanonicalValue);
  expect(storedContent.draftFields).toEqual({});
  expect(pageAfterPublish?.draftFields).toEqual({});
  expect(publicFields["hero.image"]).toBe(draftUrl);
});

test("discarding an image draft restores preview to the published image", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  const publishedStorageId = await storeImage(t, "published image");
  const draftStorageId = await storeImage(t, "discarded image");
  const publishedCanonicalValue = `convex-storage:${publishedStorageId}`;
  const draftCanonicalValue = `convex-storage:${draftStorageId}`;

  await t.mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": publishedCanonicalValue },
  });
  await t.mutation(api.cms.publishPage, { projectSlug, pageSlug });
  await t.mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": draftCanonicalValue },
  });

  const draftPreview = await t.query(api.cms.getPreviewContent, {
    projectSlug,
    pageSlug,
  });
  await t.mutation(api.cms.discardDrafts, { projectSlug, pageSlug });
  const storedContent = await getStoredPageContent(t);
  const previewAfterDiscard = await t.query(api.cms.getPreviewContent, {
    projectSlug,
    pageSlug,
  });
  const publicFields = await t.query(api.cms.getPublishedContent, {
    projectSlug,
    pageSlug,
  });
  const publishedUrl = await t.run(async (ctx) => {
    return await ctx.storage.getUrl(publishedStorageId);
  });
  const draftUrl = await t.run(async (ctx) => {
    return await ctx.storage.getUrl(draftStorageId);
  });

  expect(draftPreview["hero.image"]).toBe(draftUrl);
  expect(storedContent.publishedFields["hero.image"]).toBe(publishedCanonicalValue);
  expect(storedContent.draftFields).toEqual({});
  expect(previewAfterDiscard["hero.image"]).toBe(publishedUrl);
  expect(publicFields["hero.image"]).toBe(publishedUrl);
});

test("text and image drafts publish together and clear the unpublished page state", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  const storageId = await storeImage(t, "mixed publish image");
  const canonicalValue = `convex-storage:${storageId}`;

  await t.mutation(api.cms.seedDiscoveredFields, {
    projectSlug,
    pageSlug,
    fields: [
      { id: "hero.title", value: "Original title" },
      { id: "hero.image", value: "/original-hero.jpg" },
    ],
  });
  await t.mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: {
      "hero.title": "Published title",
      "hero.image": canonicalValue,
    },
  });

  await t.mutation(api.cms.publishPage, { projectSlug, pageSlug });
  const storedContent = await getStoredPageContent(t);
  const publicFields = await t.query(api.cms.getPublishedContent, {
    projectSlug,
    pageSlug,
  });
  const pageAfterPublish = await t.query(api.cms.getPage, {
    projectSlug,
    pageSlug,
  });
  const imageUrl = await t.run(async (ctx) => {
    return await ctx.storage.getUrl(storageId);
  });

  expect(storedContent.draftFields).toEqual({});
  expect(storedContent.publishedFields["hero.title"]).toBe("Published title");
  expect(storedContent.publishedFields["hero.image"]).toBe(canonicalValue);
  expect(publicFields["hero.title"]).toBe("Published title");
  expect(publicFields["hero.image"]).toBe(imageUrl);
  expect(pageAfterPublish?.draftFields).toEqual({});
});

test("published collection records are listed by project and collection only", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  await t.mutation(api.cms.seedPublishedCollectionItems, {
    projectSlug: "project-a",
    collectionKey: "projects",
    items: [
      {
        slug: "brand-refresh",
        data: {
          card: { title: "Brand refresh", description: "A sharper launch story." },
          stats: [{ label: "Lift", value: 38 }],
          featured: true,
        },
      },
      {
        slug: "launch-film",
        data: {
          card: { title: "Launch film", description: "A campaign hero cut." },
          featured: false,
        },
      },
    ],
  });
  await t.mutation(api.cms.seedPublishedCollectionItems, {
    projectSlug: "project-b",
    collectionKey: "projects",
    items: [
      {
        slug: "sable-workspace",
        data: { card: { title: "Sable workspace" } },
      },
    ],
  });
  await t.run(async (ctx) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_slug", (q) => q.eq("slug", "project-a"))
      .unique();
    if (!project) throw new Error("Expected seeded project");

    const item = await ctx.db
      .query("collectionItems")
      .withIndex("by_projectId_and_collectionKey_and_slug", (q) =>
        q
          .eq("projectId", project._id)
          .eq("collectionKey", "projects")
          .eq("slug", "brand-refresh"),
      )
      .unique();
    if (!item) throw new Error("Expected seeded collection item");

    await ctx.db.patch(item._id, {
      draftData: { card: { title: "Draft brand refresh" } },
    });
  });

  const projectARecords = await t.query(api.cms.listPublishedCollectionItems, {
    projectSlug: "project-a",
    collectionKey: "projects",
  });
  const projectBRecords = await t.query(api.cms.listPublishedCollectionItems, {
    projectSlug: "project-b",
    collectionKey: "projects",
  });
  const missingCollection = await t.query(api.cms.listPublishedCollectionItems, {
    projectSlug: "project-a",
    collectionKey: "team",
  });

  expect(projectARecords).toEqual([
    {
      slug: "brand-refresh",
      data: {
        card: { title: "Brand refresh", description: "A sharper launch story." },
        stats: [{ label: "Lift", value: 38 }],
        featured: true,
      },
    },
    {
      slug: "launch-film",
      data: {
        card: { title: "Launch film", description: "A campaign hero cut." },
        featured: false,
      },
    },
  ]);
  expect(projectBRecords).toEqual([
    {
      slug: "sable-workspace",
      data: { card: { title: "Sable workspace" } },
    },
  ]);
  expect(missingCollection).toEqual([]);
});

test("collection item drafts save by nested path and preview over published data", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);
  await t.mutation(api.cms.seedPublishedCollectionItems, {
    projectSlug: "project-a",
    collectionKey: "projects",
    items: [
      {
        slug: "brand-refresh",
        data: {
          card: {
            title: "Brand refresh",
            description: "Published description",
          },
          detail: {
            heroTitle: "Published hero",
          },
        },
      },
    ],
  });
  await t.mutation(api.cms.seedPublishedCollectionItems, {
    projectSlug: "project-b",
    collectionKey: "projects",
    items: [
      {
        slug: "brand-refresh",
        data: { card: { title: "Project B title" } },
      },
    ],
  });

  await t.mutation(api.cms.saveCollectionItemDraft, {
    projectSlug: "project-a",
    collectionKey: "projects",
    slug: "brand-refresh",
    path: "card.title",
    value: "Draft brand refresh",
  });

  const previewRecords = await t.query(api.cms.listPreviewCollectionItems, {
    projectSlug: "project-a",
    collectionKey: "projects",
  });
  const publicRecords = await t.query(api.cms.listPublishedCollectionItems, {
    projectSlug: "project-a",
    collectionKey: "projects",
  });
  const projectBPreview = await t.query(api.cms.listPreviewCollectionItems, {
    projectSlug: "project-b",
    collectionKey: "projects",
  });

  expect(previewRecords).toEqual([
    {
      slug: "brand-refresh",
      data: {
        card: {
          title: "Draft brand refresh",
          description: "Published description",
        },
        detail: {
          heroTitle: "Published hero",
        },
      },
    },
  ]);
  expect(publicRecords).toEqual([
    {
      slug: "brand-refresh",
      data: {
        card: {
          title: "Brand refresh",
          description: "Published description",
        },
        detail: {
          heroTitle: "Published hero",
        },
      },
    },
  ]);
  expect(projectBPreview).toEqual([
    {
      slug: "brand-refresh",
      data: { card: { title: "Project B title" } },
    },
  ]);
});
