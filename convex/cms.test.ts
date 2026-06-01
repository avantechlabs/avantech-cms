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
