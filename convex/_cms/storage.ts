import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { isRecord, STORAGE_REFERENCE_PREFIX } from "./shared";

export function storageIdFromFieldValue(value: string): Id<"_storage"> | null {
  if (!value.startsWith(STORAGE_REFERENCE_PREFIX)) return null;

  const storageId = value.slice(STORAGE_REFERENCE_PREFIX.length);
  return storageId ? (storageId as Id<"_storage">) : null;
}

export async function resolveStorageFieldValue(
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

export async function resolveStorageFieldMap(
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

export async function resolveStorageInValue(
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
