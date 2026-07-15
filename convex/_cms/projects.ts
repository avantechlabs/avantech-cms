import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  getAuthenticatedEmail,
  isAdmin,
  requireAdmin,
  requireIdentity,
  requireSiteAccess,
} from "./authz";
import { ensurePageContent } from "./pageContent";
import {
  getCollectionItem,
  getContentForPage,
  getPageForProject,
  getProject,
  getSiteMember,
  HOME_PAGE_SLUG,
  normalizeProjectSlug,
  requireNormalizedEmail,
  SEEDED_COLLECTIONS,
  SEEDED_PROJECTS,
} from "./shared";

export const ensureSeedData = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

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
    return {
      isAdmin: await isAdmin(ctx),
      email: await getAuthenticatedEmail(ctx),
    };
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
