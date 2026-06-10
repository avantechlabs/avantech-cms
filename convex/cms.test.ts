/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import type { TestConvex } from "convex-test";
import { beforeEach, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const projectSlug = "project-a";
const pageSlug = "home";
const adminEmail = "admin@avantech.test";
type CmsTest = TestConvex<typeof schema>;

function asUser(t: CmsTest, email: string) {
  return t.withIdentity({ email });
}

function asAdmin(t: CmsTest) {
  return asUser(t, adminEmail);
}

function asConvexAuthUser(t: CmsTest, userId: string) {
  return t.withIdentity({ subject: `${userId}|test-session` });
}

beforeEach(() => {
  process.env.CMS_ADMIN_EMAIL = adminEmail;
});

async function storeImage(t: CmsTest, contents: string) {
  return await t.run(async (ctx) => {
    return await ctx.storage.store(new Blob([contents], { type: "image/png" }));
  });
}

async function getStoredPageContent(t: CmsTest, targetPageSlug = pageSlug) {
  return await t.run(async (ctx) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_slug", (q) => q.eq("slug", projectSlug))
      .unique();
    if (!project) throw new Error("Expected seeded project");

    const page = await ctx.db
      .query("pages")
      .withIndex("by_projectId_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", targetPageSlug),
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

test("seeded demo project URLs match local example dev ports", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  const projectA = await asAdmin(t).query(api.cms.getProjectBySlug, { slug: "project-a" });
  const projectB = await asAdmin(t).query(api.cms.getProjectBySlug, { slug: "project-b" });

  expect(projectA?.origin).toBe("http://localhost:3001");
  expect(projectA?.editUrl).toBe("http://localhost:3001");
  expect(projectB?.origin).toBe("http://localhost:3003");
  expect(projectB?.editUrl).toBe("http://localhost:3003");
});

test("admin email controls access to the CMS project list", async () => {
  process.env.CMS_ADMIN_EMAIL = "  " + adminEmail.toUpperCase() + "  ";
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  await expect(t.query(api.cms.listProjects)).rejects.toThrow("Not authenticated");

  const projects = await asAdmin(t).query(api.cms.listProjects);
  expect(projects.map((item) => item.slug)).toEqual(["project-a", "project-b"]);
});

test("admin access resolves the email from a Convex Auth user record", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", { email: adminEmail });
  });

  const access = await asConvexAuthUser(t, userId).query(api.cms.getCmsAccess);
  const projects = await asConvexAuthUser(t, userId).query(api.cms.listProjects);

  expect(access).toEqual({ isAdmin: true });
  expect(projects.map((item) => item.slug)).toEqual(["project-a", "project-b"]);
});

test("admin can assign normalized owner emails to a site once", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  await asAdmin(t).mutation(api.cms.addSiteOwner, {
    projectSlug: "project-a",
    email: "  OWNER@Example.COM  ",
  });
  await asAdmin(t).mutation(api.cms.addSiteOwner, {
    projectSlug: "project-a",
    email: "owner@example.com",
  });

  const owners = await asAdmin(t).query(api.cms.listSiteOwners, {
    projectSlug: "project-a",
  });

  expect(owners).toEqual(["owner@example.com"]);
});

test("site owners see only assigned sites in the CMS project list", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);
  await asAdmin(t).mutation(api.cms.addSiteOwner, {
    projectSlug: "project-a",
    email: "owner@example.com",
  });

  const ownerProjects = await asUser(t, "owner@example.com").query(api.cms.listProjects);
  const unassignedProjects = await asUser(t, "unassigned@example.com").query(
    api.cms.listProjects,
  );

  expect(ownerProjects.map((item) => item.slug)).toEqual(["project-a"]);
  expect(unassignedProjects).toEqual([]);
});

test("current CMS access reports whether the signed-in user is admin", async () => {
  const t = convexTest(schema, modules);

  await expect(t.query(api.cms.getCmsAccess)).rejects.toThrow("Not authenticated");
  await expect(asAdmin(t).query(api.cms.getCmsAccess)).resolves.toEqual({ isAdmin: true });
  await expect(asUser(t, "owner@example.com").query(api.cms.getCmsAccess)).resolves.toEqual({
    isAdmin: false,
  });
});

test("site owners can edit assigned sites but not unassigned sites", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);
  await asAdmin(t).mutation(api.cms.addSiteOwner, {
    projectSlug: "project-a",
    email: "owner@example.com",
  });

  const owner = asUser(t, "owner@example.com");
  await owner.mutation(api.cms.saveDraft, {
    projectSlug: "project-a",
    pageSlug,
    fields: { "hero.title": "Owner draft" },
  });
  await owner.mutation(api.cms.publishPage, {
    projectSlug: "project-a",
    pageSlug,
  });

  const publicFields = await t.query(api.cms.getPublishedContent, {
    projectSlug: "project-a",
    pageSlug,
  });

  await expect(
    owner.mutation(api.cms.saveDraft, {
      projectSlug: "project-b",
      pageSlug,
      fields: { "hero.title": "Cross-site draft" },
    }),
  ).rejects.toThrow("Unauthorized");
  expect(publicFields["hero.title"]).toBe("Owner draft");
});

test("authenticated unassigned users cannot read protected previews", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  await expect(
    asUser(t, "unassigned@example.com").query(api.cms.getPreviewContent, {
      projectSlug: "project-a",
      pageSlug,
    }),
  ).rejects.toThrow("Unauthorized");
});

test("admin can create a project with editable home content shell", async () => {
  const t = convexTest(schema, modules);

  const project = await asAdmin(t).mutation(api.cms.createProject, {
    slug: "sable-cloud",
    name: "Sable Cloud",
    origin: "https://sable.example.com",
    editUrl: "https://sable.example.com",
  });

  expect(project?.slug).toBe("sable-cloud");
  const projects = await asAdmin(t).query(api.cms.listProjects);
  expect(projects.map((item) => item.slug)).toEqual(["sable-cloud"]);

  const pages = await asAdmin(t).query(api.cms.listPages, { projectSlug: "sable-cloud" });
  expect(pages).toEqual([
    { slug: "home", title: "Home", path: "/", draftFieldIds: [], draftCount: 0 },
  ]);
});

test("admin can update project connection URLs without changing the slug", async () => {
  const t = convexTest(schema, modules);
  await asAdmin(t).mutation(api.cms.createProject, {
    slug: "sable-cloud",
    name: "Sable Cloud",
    origin: "https://old.example.com",
    editUrl: "https://old.example.com",
  });

  const updated = await asAdmin(t).mutation(api.cms.updateProject, {
    slug: "sable-cloud",
    name: "Sable",
    origin: "https://sable.example.com",
    editUrl: "https://edit.sable.example.com",
  });

  expect(updated?.slug).toBe("sable-cloud");
  expect(updated?.name).toBe("Sable");
  expect(updated?.origin).toBe("https://sable.example.com");
  expect(updated?.editUrl).toBe("https://edit.sable.example.com");
});

test("public content reads resolve canonical Convex storage references", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  const storageId = await storeImage(t, "published image");
  const canonicalValue = `convex-storage:${storageId}`;

  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": canonicalValue },
  });
  const publishedFromMutation = await asAdmin(t).mutation(api.cms.publishPage, {
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

  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": publishedCanonicalValue },
  });
  await asAdmin(t).mutation(api.cms.publishPage, { projectSlug, pageSlug });
  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": draftCanonicalValue },
  });

  const draftUrl = await t.run(async (ctx) => {
    return await ctx.storage.getUrl(draftStorageId);
  });
  const previewFields = await asAdmin(t).query(api.cms.getPreviewContent, {
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

  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: urlFields,
  });
  await asAdmin(t).mutation(api.cms.publishPage, { projectSlug, pageSlug });

  const publicFields = await t.query(api.cms.getPublishedContent, {
    projectSlug,
    pageSlug,
  });
  const previewFields = await asAdmin(t).query(api.cms.getPreviewContent, {
    projectSlug,
    pageSlug,
  });

  expect(publicFields).toMatchObject(urlFields);
  expect(previewFields).toMatchObject(urlFields);
});

test("image discovery seeds only missing published values without replacing drafts", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  const firstSeed = await asAdmin(t).mutation(api.cms.seedDiscoveredFields, {
    projectSlug,
    pageSlug,
    fields: [{ id: "hero.image", value: "/images/static-hero.jpg" }],
  });

  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": "/images/draft-hero.jpg" },
  });

  const secondSeed = await asAdmin(t).mutation(api.cms.seedDiscoveredFields, {
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

test("image discovery returns resolved storage URLs for iframe rehydration", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  const draftStorageId = await storeImage(t, "draft image");
  const draftCanonicalValue = `convex-storage:${draftStorageId}`;
  await asAdmin(t).mutation(api.cms.seedDiscoveredFields, {
    projectSlug,
    pageSlug,
    fields: [{ id: "hero.image", value: "/images/static-hero.jpg" }],
  });
  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": draftCanonicalValue },
  });

  const seeded = await asAdmin(t).mutation(api.cms.seedDiscoveredFields, {
    projectSlug,
    pageSlug,
    fields: [{ id: "hero.image", value: "/images/static-hero.jpg" }],
  });
  const storedContent = await getStoredPageContent(t);
  const draftUrl = await t.run(async (ctx) => {
    return await ctx.storage.getUrl(draftStorageId);
  });

  expect(seeded?.["hero.image"]).toBe(draftUrl);
  expect(seeded?.["hero.image"]).not.toBe(draftCanonicalValue);
  expect(storedContent.draftFields["hero.image"]).toBe(draftCanonicalValue);
});

test("image upload flow saves a canonical draft while public output stays published", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  const publishedStorageId = await storeImage(t, "published image");
  const draftStorageId = await storeImage(t, "draft image");
  const publishedCanonicalValue = `convex-storage:${publishedStorageId}`;
  const draftCanonicalValue = `convex-storage:${draftStorageId}`;

  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": publishedCanonicalValue },
  });
  await asAdmin(t).mutation(api.cms.publishPage, { projectSlug, pageSlug });

  const uploadUrl = await asAdmin(t).mutation(api.cms.generateImageUploadUrl, {
    projectSlug,
    pageSlug,
    fieldId: "hero.image",
  });
  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": draftCanonicalValue },
  });

  const storedContent = await getStoredPageContent(t);
  const publicFields = await t.query(api.cms.getPublishedContent, {
    projectSlug,
    pageSlug,
  });
  const previewFields = await asAdmin(t).query(api.cms.getPreviewContent, {
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

  await asAdmin(t).mutation(api.cms.seedDiscoveredFields, {
    projectSlug: "project-a",
    pageSlug,
    fields: [{ id: "hero.image", value: "/project-a-published.jpg" }],
  });
  await asAdmin(t).mutation(api.cms.seedDiscoveredFields, {
    projectSlug: "project-b",
    pageSlug,
    fields: [{ id: "hero.image", value: "/project-b-published.jpg" }],
  });
  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug: "project-a",
    pageSlug,
    fields: { "hero.image": "convex-storage:project-a-draft" },
  });

  const projectA = await asAdmin(t).query(api.cms.getPreviewContent, {
    projectSlug: "project-a",
    pageSlug,
  });
  const projectB = await asAdmin(t).query(api.cms.getPreviewContent, {
    projectSlug: "project-b",
    pageSlug,
  });

  expect(projectA["hero.image"]).toBe("convex-storage:project-a-draft");
  expect(projectB["hero.image"]).toBe("/project-b-published.jpg");
});

test("page draft fields are isolated by editor language", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  await asAdmin(t).mutation(api.cms.seedDiscoveredFields, {
    projectSlug,
    pageSlug,
    language: "fr",
    fields: [{ id: "button.cta", value: "Contactez-nous" }],
  });
  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    language: "fr",
    fields: { "button.cta": "Parlez-nous" },
  });
  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    language: "en",
    fields: { "button.cta": "Contact us" },
  });

  const frenchPreview = await asAdmin(t).query(api.cms.getPreviewContent, {
    projectSlug,
    pageSlug,
    language: "fr",
  });
  const englishPreview = await asAdmin(t).query(api.cms.getPreviewContent, {
    projectSlug,
    pageSlug,
    language: "en",
  });
  const frenchPage = await asAdmin(t).query(api.cms.getPage, {
    projectSlug,
    pageSlug,
    language: "fr",
  });

  expect(frenchPreview["button.cta"]).toBe("Parlez-nous");
  expect(englishPreview["button.cta"]).toBe("Contact us");
  expect(frenchPage?.language).toBe("fr");
  expect(frenchPage?.draftFields["button.cta"]).toBe("Parlez-nous");
});

test("published page fields read the requested language with legacy fallback", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  await asAdmin(t).mutation(api.cms.seedDiscoveredFields, {
    projectSlug,
    pageSlug,
    fields: [{ id: "button.cta", value: "Contactez-nous" }],
  });
  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    language: "en",
    fields: { "button.cta": "Contact us" },
  });
  await asAdmin(t).mutation(api.cms.publishPage, {
    projectSlug,
    pageSlug,
    language: "en",
  });

  const englishPublished = await t.query(api.cms.getPublishedContent, {
    projectSlug,
    pageSlug,
    language: "en",
  });
  const frenchPublished = await t.query(api.cms.getPublishedContent, {
    projectSlug,
    pageSlug,
    language: "fr",
  });
  const legacyPublished = await t.query(api.cms.getPublishedContent, {
    projectSlug,
    pageSlug,
  });

  expect(englishPublished["button.cta"]).toBe("Contact us");
  expect(frenchPublished["button.cta"]).toBe("Contactez-nous");
  expect(legacyPublished["button.cta"]).toBe("Contactez-nous");
});

test("site-wide publish promotes only the selected language page drafts", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  await asAdmin(t).mutation(api.cms.seedDiscoveredFields, {
    projectSlug,
    pageSlug,
    fields: [{ id: "button.cta", value: "Contactez-nous" }],
  });
  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    language: "fr",
    fields: { "button.cta": "Parlez-nous" },
  });
  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    language: "en",
    fields: { "button.cta": "Contact us" },
  });

  await asAdmin(t).mutation(api.cms.publishSite, {
    projectSlug,
    language: "en",
  });

  const englishPublished = await t.query(api.cms.getPublishedContent, {
    projectSlug,
    pageSlug,
    language: "en",
  });
  const frenchPreview = await asAdmin(t).query(api.cms.getPreviewContent, {
    projectSlug,
    pageSlug,
    language: "fr",
  });
  const englishDraftState = await asAdmin(t).query(api.cms.getSiteDraftState, {
    projectSlug,
    pageSlug,
    language: "en",
  });
  const frenchDraftState = await asAdmin(t).query(api.cms.getSiteDraftState, {
    projectSlug,
    pageSlug,
    language: "fr",
  });

  expect(englishPublished["button.cta"]).toBe("Contact us");
  expect(frenchPreview["button.cta"]).toBe("Parlez-nous");
  expect(englishDraftState.pageDraftFieldIds).toEqual([]);
  expect(frenchDraftState.pageDraftFieldIds).toEqual(["button.cta"]);
});

test("site-wide discard clears only the selected language page drafts", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    language: "fr",
    fields: { "button.cta": "Parlez-nous" },
  });
  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    language: "en",
    fields: { "button.cta": "Contact us" },
  });

  await asAdmin(t).mutation(api.cms.discardSiteDrafts, {
    projectSlug,
    language: "en",
  });

  const englishPreview = await asAdmin(t).query(api.cms.getPreviewContent, {
    projectSlug,
    pageSlug,
    language: "en",
  });
  const frenchPreview = await asAdmin(t).query(api.cms.getPreviewContent, {
    projectSlug,
    pageSlug,
    language: "fr",
  });

  expect(englishPreview["button.cta"]).toBeUndefined();
  expect(frenchPreview["button.cta"]).toBe("Parlez-nous");
});

test("website-declared pages sync, isolate drafts, and publish or discard project-wide", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);
  await asAdmin(t).mutation(api.cms.syncPages, {
    projectSlug,
    pages: [
      { slug: "home", title: "Home", path: "/" },
      { slug: "pricing", title: "Pricing", path: "/pricing" },
    ],
  });

  const pages = await asAdmin(t).query(api.cms.listPages, { projectSlug });
  expect(pages).toEqual([
    { slug: "home", title: "Home", path: "/", draftFieldIds: [], draftCount: 0 },
    { slug: "pricing", title: "Pricing", path: "/pricing", draftFieldIds: [], draftCount: 0 },
  ]);

  await asAdmin(t).mutation(api.cms.seedDiscoveredFields, {
    projectSlug,
    pageSlug: "home",
    fields: [{ id: "hero.title", value: "Published home title" }],
  });
  await asAdmin(t).mutation(api.cms.seedDiscoveredFields, {
    projectSlug,
    pageSlug: "pricing",
    fields: [{ id: "pricing.hero.title", value: "Published pricing title" }],
  });
  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug: "pricing",
    fields: { "pricing.hero.title": "Draft pricing title" },
  });

  const homePreview = await asAdmin(t).query(api.cms.getPreviewContent, {
    projectSlug,
    pageSlug: "home",
  });
  const pricingPreview = await asAdmin(t).query(api.cms.getPreviewContent, {
    projectSlug,
    pageSlug: "pricing",
  });
  const draftState = await asAdmin(t).query(api.cms.getSiteDraftState, {
    projectSlug,
    pageSlug: "pricing",
  });
  const pagesWithDraft = await asAdmin(t).query(api.cms.listPages, { projectSlug });

  expect(homePreview["hero.title"]).toBe("Published home title");
  expect(pricingPreview["pricing.hero.title"]).toBe("Draft pricing title");
  expect(draftState.pageDraftFieldIds).toEqual(["pricing.hero.title"]);
  expect(draftState.pageDrafts).toEqual([
    { pageSlug: "pricing", fieldIds: ["pricing.hero.title"], draftCount: 1 },
  ]);
  expect(draftState.totalDraftCount).toBe(1);
  expect(pagesWithDraft).toEqual([
    { slug: "home", title: "Home", path: "/", draftFieldIds: [], draftCount: 0 },
    {
      slug: "pricing",
      title: "Pricing",
      path: "/pricing",
      draftFieldIds: ["pricing.hero.title"],
      draftCount: 1,
    },
  ]);

  await asAdmin(t).mutation(api.cms.publishSite, { projectSlug });
  const publishedPricing = await t.query(api.cms.getPublishedContent, {
    projectSlug,
    pageSlug: "pricing",
  });
  const pricingContentAfterPublish = await getStoredPageContent(t, "pricing");
  const draftStateAfterPublish = await asAdmin(t).query(api.cms.getSiteDraftState, {
    projectSlug,
    pageSlug: "pricing",
  });

  expect(publishedPricing["pricing.hero.title"]).toBe("Draft pricing title");
  expect(pricingContentAfterPublish.draftFields).toEqual({});
  expect(draftStateAfterPublish.totalDraftCount).toBe(0);

  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug: "home",
    fields: { "hero.title": "Discarded home title" },
  });
  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug: "pricing",
    fields: { "pricing.hero.title": "Discarded pricing title" },
  });
  await asAdmin(t).mutation(api.cms.discardSiteDrafts, { projectSlug });

  const homeAfterDiscard = await asAdmin(t).query(api.cms.getPreviewContent, {
    projectSlug,
    pageSlug: "home",
  });
  const pricingAfterDiscard = await asAdmin(t).query(api.cms.getPreviewContent, {
    projectSlug,
    pageSlug: "pricing",
  });
  const finalDraftState = await asAdmin(t).query(api.cms.getSiteDraftState, {
    projectSlug,
    pageSlug: "home",
  });

  expect(homeAfterDiscard["hero.title"]).toBe("Published home title");
  expect(pricingAfterDiscard["pricing.hero.title"]).toBe("Draft pricing title");
  expect(finalDraftState.totalDraftCount).toBe(0);
});

test("publishing an image draft promotes it to published content and clears drafts", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  const originalStorageId = await storeImage(t, "original image");
  const draftStorageId = await storeImage(t, "replacement image");
  const originalCanonicalValue = `convex-storage:${originalStorageId}`;
  const draftCanonicalValue = `convex-storage:${draftStorageId}`;

  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": originalCanonicalValue },
  });
  await asAdmin(t).mutation(api.cms.publishPage, { projectSlug, pageSlug });
  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": draftCanonicalValue },
  });

  const pageWithDraft = await asAdmin(t).query(api.cms.getPage, { projectSlug, pageSlug });
  const publishedFields = await asAdmin(t).mutation(api.cms.publishPage, {
    projectSlug,
    pageSlug,
  });
  const storedContent = await getStoredPageContent(t);
  const pageAfterPublish = await asAdmin(t).query(api.cms.getPage, { projectSlug, pageSlug });
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

  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": publishedCanonicalValue },
  });
  await asAdmin(t).mutation(api.cms.publishPage, { projectSlug, pageSlug });
  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.image": draftCanonicalValue },
  });

  const draftPreview = await asAdmin(t).query(api.cms.getPreviewContent, {
    projectSlug,
    pageSlug,
  });
  await asAdmin(t).mutation(api.cms.discardDrafts, { projectSlug, pageSlug });
  const storedContent = await getStoredPageContent(t);
  const previewAfterDiscard = await asAdmin(t).query(api.cms.getPreviewContent, {
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

  await asAdmin(t).mutation(api.cms.seedDiscoveredFields, {
    projectSlug,
    pageSlug,
    fields: [
      { id: "hero.title", value: "Original title" },
      { id: "hero.image", value: "/original-hero.jpg" },
    ],
  });
  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: {
      "hero.title": "Published title",
      "hero.image": canonicalValue,
    },
  });

  await asAdmin(t).mutation(api.cms.publishPage, { projectSlug, pageSlug });
  const storedContent = await getStoredPageContent(t);
  const publicFields = await t.query(api.cms.getPublishedContent, {
    projectSlug,
    pageSlug,
  });
  const pageAfterPublish = await asAdmin(t).query(api.cms.getPage, {
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

  await asAdmin(t).mutation(api.cms.seedPublishedCollectionItems, {
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
  await asAdmin(t).mutation(api.cms.seedPublishedCollectionItems, {
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
  await asAdmin(t).mutation(api.cms.seedPublishedCollectionItems, {
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
  await asAdmin(t).mutation(api.cms.seedPublishedCollectionItems, {
    projectSlug: "project-b",
    collectionKey: "projects",
    items: [
      {
        slug: "brand-refresh",
        data: { card: { title: "Project B title" } },
      },
    ],
  });

  await asAdmin(t).mutation(api.cms.saveCollectionItemDraft, {
    projectSlug: "project-a",
    collectionKey: "projects",
    slug: "brand-refresh",
    path: "card.title",
    value: "Draft brand refresh",
  });

  const previewRecords = await asAdmin(t).query(api.cms.listPreviewCollectionItems, {
    projectSlug: "project-a",
    collectionKey: "projects",
  });
  const publicRecords = await t.query(api.cms.listPublishedCollectionItems, {
    projectSlug: "project-a",
    collectionKey: "projects",
  });
  const projectBPreview = await asAdmin(t).query(api.cms.listPreviewCollectionItems, {
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

test("collection item drafts publish by selected language without overwriting global records", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);
  await asAdmin(t).mutation(api.cms.seedPublishedCollectionItems, {
    projectSlug,
    collectionKey: "services",
    items: [
      {
        slug: "compagnonnage",
        data: {
          title: "Companionship and presence at home",
          body: "Conversation, reading, walks, board games.",
        },
      },
    ],
  });

  await asAdmin(t).mutation(api.cms.saveCollectionItemDraft, {
    projectSlug,
    collectionKey: "services",
    slug: "compagnonnage",
    language: "fr",
    path: "title",
    value: "Compagnonnage et presence a domicile",
  });
  await asAdmin(t).mutation(api.cms.saveCollectionItemDraft, {
    projectSlug,
    collectionKey: "services",
    slug: "compagnonnage",
    language: "fr",
    path: "body",
    value: "Conversation, lecture, marche, jeux de societe.",
  });

  const frenchPreview = await asAdmin(t).query(api.cms.listPreviewCollectionItems, {
    projectSlug,
    collectionKey: "services",
    language: "fr",
  });
  const englishBeforePublish = await t.query(api.cms.listPublishedCollectionItems, {
    projectSlug,
    collectionKey: "services",
    language: "en",
  });

  await asAdmin(t).mutation(api.cms.publishSite, { projectSlug, language: "fr" });

  const frenchPublished = await t.query(api.cms.listPublishedCollectionItems, {
    projectSlug,
    collectionKey: "services",
    language: "fr",
  });
  const englishAfterPublish = await t.query(api.cms.listPublishedCollectionItems, {
    projectSlug,
    collectionKey: "services",
    language: "en",
  });

  expect(frenchPreview).toEqual([
    {
      slug: "compagnonnage",
      data: {
        title: "Compagnonnage et presence a domicile",
        body: "Conversation, lecture, marche, jeux de societe.",
      },
    },
  ]);
  expect(frenchPublished).toEqual(frenchPreview);
  expect(englishBeforePublish).toEqual([
    {
      slug: "compagnonnage",
      data: {
        title: "Companionship and presence at home",
        body: "Conversation, reading, walks, board games.",
      },
    },
  ]);
  expect(englishAfterPublish).toEqual(englishBeforePublish);
});

test("object and list collection drafts preview, publish, and discard through site lifecycle", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);
  await asAdmin(t).mutation(api.cms.seedPublishedCollectionItems, {
    projectSlug,
    collectionKey: "projects",
    items: [
      {
        slug: "brand-refresh",
        data: {
          seo: { title: "Published SEO title" },
          benefits: [{ id: "first", title: "Published benefit" }],
        },
      },
    ],
  });

  await asAdmin(t).mutation(api.cms.saveCollectionItemDraft, {
    projectSlug,
    collectionKey: "projects",
    slug: "brand-refresh",
    path: "seo.title",
    value: "Draft SEO title",
  });
  await asAdmin(t).mutation(api.cms.saveCollectionItemDraft, {
    projectSlug,
    collectionKey: "projects",
    slug: "brand-refresh",
    path: "benefits",
    value: [
      { id: "second", title: "Second benefit" },
      { id: "first", title: "Updated first benefit" },
    ],
  });

  const previewBeforePublish = await asAdmin(t).query(api.cms.listPreviewCollectionItems, {
    projectSlug,
    collectionKey: "projects",
  });
  const publicBeforePublish = await t.query(api.cms.listPublishedCollectionItems, {
    projectSlug,
    collectionKey: "projects",
  });

  await asAdmin(t).mutation(api.cms.publishSite, { projectSlug, pageSlug });
  const publicAfterPublish = await t.query(api.cms.listPublishedCollectionItems, {
    projectSlug,
    collectionKey: "projects",
  });

  await asAdmin(t).mutation(api.cms.saveCollectionItemDraft, {
    projectSlug,
    collectionKey: "projects",
    slug: "brand-refresh",
    path: "benefits",
    value: [{ id: "discarded", title: "Discarded benefit" }],
  });
  await asAdmin(t).mutation(api.cms.discardSiteDrafts, { projectSlug, pageSlug });
  const previewAfterDiscard = await asAdmin(t).query(api.cms.listPreviewCollectionItems, {
    projectSlug,
    collectionKey: "projects",
  });

  expect(previewBeforePublish).toEqual([
    {
      slug: "brand-refresh",
      data: {
        seo: { title: "Draft SEO title" },
        benefits: [
          { id: "second", title: "Second benefit" },
          { id: "first", title: "Updated first benefit" },
        ],
      },
    },
  ]);
  expect(publicBeforePublish).toEqual([
    {
      slug: "brand-refresh",
      data: {
        seo: { title: "Published SEO title" },
        benefits: [{ id: "first", title: "Published benefit" }],
      },
    },
  ]);
  expect(publicAfterPublish).toEqual(previewBeforePublish);
  expect(previewAfterDiscard).toEqual(publicAfterPublish);
});

test("site-wide publish promotes page and collection drafts together", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);
  await asAdmin(t).mutation(api.cms.seedDiscoveredFields, {
    projectSlug,
    pageSlug,
    fields: [{ id: "hero.title", value: "Published page title" }],
  });
  await asAdmin(t).mutation(api.cms.seedPublishedCollectionItems, {
    projectSlug,
    collectionKey: "projects",
    items: [
      {
        slug: "brand-refresh",
        data: { card: { title: "Published record title" } },
      },
    ],
  });

  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.title": "Draft page title" },
  });
  await asAdmin(t).mutation(api.cms.saveCollectionItemDraft, {
    projectSlug,
    collectionKey: "projects",
    slug: "brand-refresh",
    path: "card.title",
    value: "Draft record title",
  });

  const draftState = await asAdmin(t).query(api.cms.getSiteDraftState, {
    projectSlug,
    pageSlug,
  });
  await asAdmin(t).mutation(api.cms.publishSite, { projectSlug, pageSlug });
  const pageAfterPublish = await asAdmin(t).query(api.cms.getPage, { projectSlug, pageSlug });
  const publicFields = await t.query(api.cms.getPublishedContent, {
    projectSlug,
    pageSlug,
  });
  const publicRecords = await t.query(api.cms.listPublishedCollectionItems, {
    projectSlug,
    collectionKey: "projects",
  });
  const draftStateAfterPublish = await asAdmin(t).query(api.cms.getSiteDraftState, {
    projectSlug,
    pageSlug,
  });

  expect(draftState).toEqual({
    pageDraftFieldIds: ["hero.title"],
    pageDrafts: [{ pageSlug, fieldIds: ["hero.title"], draftCount: 1 }],
    collectionDrafts: [{ collectionKey: "projects", slug: "brand-refresh" }],
    collectionDraftCount: 1,
    totalDraftCount: 2,
  });
  expect(pageAfterPublish?.draftFields).toEqual({});
  expect(publicFields["hero.title"]).toBe("Draft page title");
  expect(publicRecords).toEqual([
    {
      slug: "brand-refresh",
      data: { card: { title: "Draft record title" } },
    },
  ]);
  expect(draftStateAfterPublish.totalDraftCount).toBe(0);
});

test("site-wide discard clears page and collection drafts without changing published data", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);
  await asAdmin(t).mutation(api.cms.seedDiscoveredFields, {
    projectSlug,
    pageSlug,
    fields: [{ id: "hero.title", value: "Published page title" }],
  });
  await asAdmin(t).mutation(api.cms.seedPublishedCollectionItems, {
    projectSlug,
    collectionKey: "projects",
    items: [
      {
        slug: "brand-refresh",
        data: { card: { title: "Published record title" } },
      },
    ],
  });

  await asAdmin(t).mutation(api.cms.saveDraft, {
    projectSlug,
    pageSlug,
    fields: { "hero.title": "Discarded page title" },
  });
  await asAdmin(t).mutation(api.cms.saveCollectionItemDraft, {
    projectSlug,
    collectionKey: "projects",
    slug: "brand-refresh",
    path: "card.title",
    value: "Discarded record title",
  });

  await asAdmin(t).mutation(api.cms.discardSiteDrafts, { projectSlug, pageSlug });
  const pageAfterDiscard = await asAdmin(t).query(api.cms.getPage, { projectSlug, pageSlug });
  const publicFields = await t.query(api.cms.getPublishedContent, {
    projectSlug,
    pageSlug,
  });
  const previewRecords = await asAdmin(t).query(api.cms.listPreviewCollectionItems, {
    projectSlug,
    collectionKey: "projects",
  });
  const draftState = await asAdmin(t).query(api.cms.getSiteDraftState, {
    projectSlug,
    pageSlug,
  });

  expect(pageAfterDiscard?.draftFields).toEqual({});
  expect(publicFields["hero.title"]).toBe("Published page title");
  expect(previewRecords).toEqual([
    {
      slug: "brand-refresh",
      data: { card: { title: "Published record title" } },
    },
  ]);
  expect(draftState.totalDraftCount).toBe(0);
});

test("draft-only collection records preview, publish, and discard through site lifecycle", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  await asAdmin(t).mutation(api.cms.createCollectionItemDraft, {
    projectSlug,
    collectionKey: "projects",
    slug: "new-project",
    data: { card: { title: "New project" } },
  });

  const previewBeforePublish = await asAdmin(t).query(api.cms.listPreviewCollectionItems, {
    projectSlug,
    collectionKey: "projects",
  });
  const publicBeforePublish = await t.query(api.cms.listPublishedCollectionItems, {
    projectSlug,
    collectionKey: "projects",
  });
  const draftState = await asAdmin(t).query(api.cms.getSiteDraftState, { projectSlug, pageSlug });

  await asAdmin(t).mutation(api.cms.publishSite, { projectSlug, pageSlug });
  const publicAfterPublish = await t.query(api.cms.listPublishedCollectionItems, {
    projectSlug,
    collectionKey: "projects",
  });
  const draftStateAfterPublish = await asAdmin(t).query(api.cms.getSiteDraftState, {
    projectSlug,
    pageSlug,
  });

  await asAdmin(t).mutation(api.cms.createCollectionItemDraft, {
    projectSlug,
    collectionKey: "projects",
    slug: "discarded-project",
    data: { card: { title: "Discard me" } },
  });
  await asAdmin(t).mutation(api.cms.discardSiteDrafts, { projectSlug, pageSlug });
  const previewAfterDiscard = await asAdmin(t).query(api.cms.listPreviewCollectionItems, {
    projectSlug,
    collectionKey: "projects",
  });

  expect(previewBeforePublish).toEqual([
    { slug: "new-project", data: { card: { title: "New project" } } },
  ]);
  expect(publicBeforePublish).toEqual([]);
  expect(draftState.collectionDraftCount).toBe(1);
  expect(draftState.collectionDrafts).toEqual([
    { collectionKey: "projects", slug: "new-project" },
  ]);
  expect(publicAfterPublish).toEqual([
    { slug: "new-project", data: { card: { title: "New project" } } },
  ]);
  expect(draftStateAfterPublish.totalDraftCount).toBe(0);
  expect(previewAfterDiscard).toEqual([
    { slug: "new-project", data: { card: { title: "New project" } } },
  ]);
});

test("collection media references resolve in preview and publish through site lifecycle", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cms.ensureSeedData);

  const publishedStorageId = await storeImage(t, "published collection image");
  const draftStorageId = await storeImage(t, "draft collection image");
  const publishedCanonicalValue = `convex-storage:${publishedStorageId}`;
  const draftCanonicalValue = `convex-storage:${draftStorageId}`;

  await asAdmin(t).mutation(api.cms.seedPublishedCollectionItems, {
    projectSlug,
    collectionKey: "projects",
    items: [
      {
        slug: "brand-refresh",
        data: { media: { cover: publishedCanonicalValue } },
      },
    ],
  });

  const uploadUrl = await asAdmin(t).mutation(api.cms.generateCollectionFileUploadUrl, {
    projectSlug,
    collectionKey: "projects",
    slug: "brand-refresh",
    path: "media.cover",
  });
  await asAdmin(t).mutation(api.cms.saveCollectionItemDraft, {
    projectSlug,
    collectionKey: "projects",
    slug: "brand-refresh",
    path: "media.cover",
    value: draftCanonicalValue,
  });

  const publicBeforePublish = await t.query(api.cms.listPublishedCollectionItems, {
    projectSlug,
    collectionKey: "projects",
  });
  const previewBeforePublish = await asAdmin(t).query(api.cms.listPreviewCollectionItems, {
    projectSlug,
    collectionKey: "projects",
  });
  await asAdmin(t).mutation(api.cms.publishSite, { projectSlug, pageSlug });
  const publicAfterPublish = await t.query(api.cms.listPublishedCollectionItems, {
    projectSlug,
    collectionKey: "projects",
  });
  const publishedUrl = await t.run(async (ctx) => ctx.storage.getUrl(publishedStorageId));
  const draftUrl = await t.run(async (ctx) => ctx.storage.getUrl(draftStorageId));

  expect(uploadUrl).toMatch(/^https:\/\/some-deployment\.convex\.cloud\/api\/storage\/upload\?token=/);
  expect(publicBeforePublish).toEqual([
    { slug: "brand-refresh", data: { media: { cover: publishedUrl } } },
  ]);
  expect(previewBeforePublish).toEqual([
    { slug: "brand-refresh", data: { media: { cover: draftUrl } } },
  ]);
  expect(publicAfterPublish).toEqual([
    { slug: "brand-refresh", data: { media: { cover: draftUrl } } },
  ]);
});
