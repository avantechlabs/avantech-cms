import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { getSiteMember, normalizeEmail } from "./shared";

export async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
}

export async function getAuthenticatedEmail(ctx: QueryCtx | MutationCtx) {
  const identity = await requireIdentity(ctx);
  const identityEmail = normalizeEmail(identity.email);
  if (identityEmail) return identityEmail;

  const userId = await getAuthUserId(ctx);
  if (!userId) return "";

  const user = await ctx.db.get(userId);
  return normalizeEmail(user?.email);
}

export async function isAdmin(ctx: QueryCtx | MutationCtx) {
  const adminEmail = normalizeEmail(process.env.CMS_ADMIN_EMAIL);
  if (!adminEmail) return false;

  return (await getAuthenticatedEmail(ctx)) === adminEmail;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  await requireIdentity(ctx);
  if (!(await isAdmin(ctx))) throw new Error("Unauthorized");
}

export async function requireSiteAccess(
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
