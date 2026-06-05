import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    slug: v.string(),
    name: v.string(),
    origin: v.string(),
    editUrl: v.string(),
  }).index("by_slug", ["slug"]),

  pages: defineTable({
    projectId: v.id("projects"),
    slug: v.string(),
    title: v.string(),
    path: v.optional(v.string()),
  }).index("by_projectId_and_slug", ["projectId", "slug"]),

  pageContent: defineTable({
    projectId: v.id("projects"),
    pageId: v.id("pages"),
    draftFields: v.record(v.string(), v.string()),
    publishedFields: v.record(v.string(), v.string()),
    lastSeenAt: v.optional(v.record(v.string(), v.number())),
    draftUpdatedAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_projectId_and_pageId", ["projectId", "pageId"]),

  collectionItems: defineTable({
    projectId: v.id("projects"),
    collectionKey: v.string(),
    slug: v.string(),
    publishedData: v.optional(v.any()),
    draftData: v.optional(v.any()),
    publishedAt: v.optional(v.number()),
    draftUpdatedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_projectId_and_collectionKey", ["projectId", "collectionKey"])
    .index("by_projectId_and_collectionKey_and_slug", [
      "projectId",
      "collectionKey",
      "slug",
    ]),
});
