# CMS Persistence V1 — Audit

Audited against the "CMS Persistence V1" spec. Each finding cites `file:line`, quotes the code, and gives a verdict (MATCHES / PARTIAL / GAP) with the minimal fix.

Files audited:
- `convex/schema.ts`
- `convex/cms.ts`
- `examples/shared/useCmsPage.jsx`
- `packages/cms-bridge/bridge.js`
- (supporting) `src/main.jsx`, `src/hooks/useFieldManager.ts`

---

## 1. Core model — one row per page, same-row draft/published

**Verdict: MATCHES**

`convex/schema.ts:18-26` defines a single `pageContent` table keyed by `(projectId, pageId)` with `draftFields` and `publishedFields` both on the same row.

```ts
pageContent: defineTable({
  projectId: v.id("projects"),
  pageId: v.id("pages"),
  draftFields: v.record(v.string(), v.string()),
  publishedFields: v.record(v.string(), v.string()),
  draftUpdatedAt: v.optional(v.number()),
  publishedAt: v.optional(v.number()),
  updatedAt: v.number(),
}).index("by_projectId_and_pageId", ["projectId", "pageId"]),
```

One row, no separate draft/published rows, no per-field table. The "draftValue undefined = no unpublished edit" semantic is represented by absence of the key in `draftFields` (a record), which is correct.

---

## 2. Discovery is idempotent — never overwrite existing published/draft values

**Verdict: PARTIAL** (published guard is correct; draft preservation is correct; `lastSeenAt` is missing)

`convex/cms.ts:218-245` `seedDiscoveredFields`:

```ts
const draftFields = { ...(content?.draftFields ?? {}) };
const publishedFields = { ...(content?.publishedFields ?? {}) };

for (const field of args.fields) {
  if (!(field.id in publishedFields)) publishedFields[field.id] = field.value;
}

await upsertPageContent(ctx, result.project._id, result.page._id, content, {
  publishedFields,
});
```

- **NEVER overwrite existing publishedValue → MATCHES.** The guard `if (!(field.id in publishedFields))` (cms.ts:233) means an already-seeded field keeps its existing publishedValue. Re-running discovery is a no-op for known fields.
- **NEVER overwrite existing draftValue → MATCHES.** The patch only writes `publishedFields` (cms.ts:236-238). `draftFields` is read into a local (cms.ts:229) but never written back, so the stored `draftFields` is untouched. New fields correctly get `publishedValue = discovered text` and `draftValue` absent (cms.ts:233; the field never enters draftFields).
- **Create missing field/content rows → MATCHES (for content row).** `upsertPageContent` (cms.ts:82-106) inserts a `pageContent` row when none exists. Project/page rows are created by `ensureSeedData`, not here; discovery assumes they exist (`requireContent` returns null and the mutation no-ops if the page is missing — cms.ts:225-226). Acceptable for v1 since only `home` is seeded.
- **Update lightweight metadata like `lastSeenAt` → GAP.** There is no `lastSeenAt` field anywhere — not in the schema (`schema.ts:18-26`), not written by `seedDiscoveredFields`. The schema has `updatedAt`, `draftUpdatedAt`, `publishedAt` only. **Minimal fix:** add `lastSeenAt: v.optional(v.number())` to `pageContent` in `schema.ts`, and in `seedDiscoveredFields` pass `lastSeenAt: Date.now()` in the patch (and have `upsertPageContent` forward it). Note `upsertPageContent` already bumps `updatedAt` on every patch (cms.ts:96), so there is *some* timestamp churn, but no per-discovery "last seen" signal as the spec asks.
- **Ignore non-editable/container fields → PARTIAL.** Filtering happens **client-side only**: `src/main.jsx:61` `nextFields.filter((f) => f.editable !== false)` and `:66` maps only editable fields into the mutation args. The bridge tags `editable` via `isEditableField` (`bridge.js:11-13`, `:24`). The mutation `seedDiscoveredFields` itself does **not** receive or check an `editable` flag — its `discoveredFieldsValidator` is `{ id, value }` only (cms.ts:24-29). So a direct/malicious or future caller bypassing the editor could seed a container field. **Minimal fix (optional for v1):** either keep relying on the client filter (acceptable since the editor is the only caller) or have the bridge omit non-editable fields from the discovery payload. Container exclusion is enforced, just not defense-in-depth at the persistence boundary.

---

## 3. Editing writes ONLY draftValue

**Verdict: MATCHES**

`convex/cms.ts:247-269` `saveDraft`:

```ts
const nextDraftFields = {
  ...(result.content?.draftFields ?? {}),
  ...args.fields,
};
await upsertPageContent(ctx, result.project._id, result.page._id, result.content, {
  draftFields: nextDraftFields,
  draftUpdatedAt: Date.now(),
});
```

Only `draftFields` (+ `draftUpdatedAt`) is patched. `publishedFields` is never touched, so the live value is unchanged until publish. Merge-with-existing-drafts means partial saves accumulate correctly. (Explicit save-button UX is out of v1, as noted.)

---

## 4. Rendering

### 4a. Public site renders `publishedValue`, CRASH if missing

**Verdict: MATCHES**

`examples/shared/useCmsPage.jsx` uses the published query for the public path:

- `useCmsPage` (`:39-62`) queries `cms:getPublishedContent` (`:40`) and, when **not** in edit mode (`:46`), iterates editable DOM fields and throws on any missing key:

```jsx
if (!Object.prototype.hasOwnProperty.call(publishedFields, fieldId)) {
  throw new Error(`Missing published CMS value for ${projectSlug}/${pageSlug}:${fieldId}`);
}
```
(useCmsPage.jsx:50-52)

- `CmsText` (`:93-103`) is the component-render path and throws identically when the field is absent from published content:

```jsx
if (!Object.prototype.hasOwnProperty.call(cms.fields, fieldId)) {
  throw new Error(`Missing published CMS value for ${cms.projectSlug}/${cms.pageSlug}:${fieldId}`);
}
return cms.fields[fieldId];
```
(useCmsPage.jsx:98-102)

There is **no silent fallback** to draft or to DOM text on the public path — a missing publishedValue crashes, which is what the spec wants (so a seeding/publishing bug surfaces loudly). `hasOwnProperty` is the right check (an empty-string published value `""` is truthy-falsy-safe and won't trip the guard).

### 4b. CMS preview/edit mode renders `draftValue ?? publishedValue`, crash if BOTH missing

**Verdict: GAP (two issues)**

- **Preview query computes the right merge, but the render components never use it.** `getPreviewContent` (cms.ts:202-216) returns `{ ...publishedFields, ...draftFields }` — correct `draftValue ?? publishedValue` precedence (draft overrides published). **But no client code calls `cms:getPreviewContent`.** Both `useCmsPage` (`:40`) and `CmsContentProvider` (`:70`) query `PUBLISHED_CONTENT_QUERY = "cms:getPublishedContent"` (`:5`) regardless of mode. In edit mode the render path is short-circuited (`isEditMode()` returns early at `:46` and `:96`), and the editor instead pushes values into the iframe via `cms:apply-fields` / `cms:update-field` (bridge.js:69-79) using state held in `useFieldManager`. So the spec's "preview renders draftValue ?? publishedValue" is satisfied **only** through the editor's live message channel, not through `getPreviewContent`. `getPreviewContent` is effectively **dead code** in v1. Not a correctness bug, but a spec/implementation mismatch worth flagging: if you intended preview to render from the merged query, wire `CmsContentProvider` (and `useCmsPage`) to call `getPreviewContent` when `mode !== "public"` / when `edit=1`.

- **"If BOTH missing → crash" is NOT enforced in preview/edit mode → GAP.** In edit mode both render paths return children early without any presence check:
  - `useCmsPage.jsx:46` — `if (!publishedFields || isEditMode()) return;` (skips the throw loop entirely in edit mode)
  - `useCmsPage.jsx:96` — `if (!cms || isEditMode() || !cms.isLoaded) return children;` (CmsText returns raw children, never checks the merged value)

  So in preview/edit mode a field that is missing from *both* draft and published silently falls back to the DOM/children text instead of crashing. The spec explicitly wants a crash when both are missing. **Minimal fix:** when in edit/preview mode, render from the merged `getPreviewContent` result and throw if a field key is absent from the merged map (mirror the public-path `hasOwnProperty` throw). Today the only "value" in edit mode is whatever the editor state happens to hold, which masks the both-missing case.

---

## 5. Publishing — promote drafts, clear draftValue per published field

**Verdict: PARTIAL** (promotion correct; draft-clear is too broad, not per-published-field)

`convex/cms.ts:271-294` `publishPage`:

```ts
const draftFields = result.content?.draftFields ?? {};
const publishedFields = {
  ...(result.content?.publishedFields ?? {}),
  ...draftFields,
};
await upsertPageContent(ctx, result.project._id, result.page._id, result.content, {
  draftFields: {},
  publishedFields,
  publishedAt: Date.now(),
});
```

- **For each field with draftValue defined → publishedValue = draftValue → MATCHES.** `{ ...published, ...draft }` (cms.ts:281-284) overlays every drafted field onto published; fields without a draft keep their published value. `publishedAt = now` set (cms.ts:289).
- **Clear draftValue after publish → PARTIAL / over-broad.** The code clears **all** drafts via `draftFields: {}` (cms.ts:287). The spec says "for each field: if draftValue is defined → ... draftValue = undefined." In v1 these are equivalent in effect (publish processes the whole page and every drafted field is promoted, so resetting to `{}` clears exactly the promoted set — no draft is lost that wasn't published). So functionally **correct for v1**. The nuance: `publishedAt` is a single page-level timestamp, not per-field; the spec phrases publish per-field but the row only has one `publishedAt`. Acceptable given "only page is `home` in v1" and whole-page publish. **No fix required for v1**; if per-field publish is ever added, switch the clear to delete only the keys that were promoted rather than `{}`.

---

## 6. Seed behavior — must not reset content after content exists

**Verdict: MATCHES**

`convex/cms.ts:108-157` `ensureSeedData`:

- Existing project rows are **patched** with `name`/`origin`/`editUrl` only (cms.ts:120-124) — never content. (Spec says seed may patch name/slug/editUrl; note: `slug` is the index key and is intentionally *not* patched, which is correct — re-slugging would break the `by_slug` lookup. `origin` is patched, which is benign metadata.)
- Page row created only if missing (cms.ts:128).
- Content row created only if missing:

```ts
const content = await getContentForPage(ctx, project._id, page._id);
if (!content) {
  await ctx.db.insert("pageContent", { ...draftFields: {}, publishedFields: {}, ... });
}
```
(cms.ts:143-152)

There is **no patch/overwrite of an existing `pageContent` row** in `ensureSeedData`. Re-running it never resets `draftFields` or `publishedFields`. Matches the spec's "seed must NOT reset content after content exists."

---

## 7. Project identity — keep both projectSlug and projectId; isolate by projectId; no projectId → no content query

**Verdict: MATCHES**

- Both kept: `projects` has `slug` (schema.ts:6) addressed via `getProject` → `by_slug` (cms.ts:35-38); content identity is `projectId` (`Id<"projects">`) on `pages` and `pageContent` (schema.ts:13, 19).
- All content queries/mutations isolate by `projectId`: `requireContent` (cms.ts:67-80) resolves slug→project, then every content access goes through `getPageForProject`/`getContentForPage` which filter on `projectId` via `by_projectId_and_slug` (cms.ts:48-49) and `by_projectId_and_pageId` (cms.ts:61-62).
- **No projectId → no content query → MATCHES.** `requireContent` returns `null` when the project (or page) is not found (cms.ts:72-78), and every consumer guards on that: `getPage` (`:180`), `getPublishedContent` (`:198` via `?.`), `getPreviewContent` (`:209`), `seedDiscoveredFields` (`:226`), `saveDraft` (`:255`), `publishPage` (`:278`). No content table is ever queried without a resolved `projectId`.

---

## Summary table

| # | Spec requirement | Verdict | Where |
|---|---|---|---|
| 1 | Single same-row model | MATCHES | schema.ts:18-26 |
| 2a | Discovery never overwrites publishedValue | MATCHES | cms.ts:233 |
| 2b | Discovery never overwrites draftValue | MATCHES | cms.ts:236-238 |
| 2c | Discovery updates `lastSeenAt` | **GAP** | absent in schema.ts:18-26 / cms.ts:218-245 |
| 2d | Discovery ignores non-editable/container fields | PARTIAL (client-only) | main.jsx:61, 66 vs cms.ts:24-29 |
| 3 | Editing writes only draftValue | MATCHES | cms.ts:262-265 |
| 4a | Public renders publishedValue, CRASH if missing | MATCHES | useCmsPage.jsx:50-52, 98-102 |
| 4b | Preview renders draft ?? published; crash if both missing | **GAP** | useCmsPage.jsx:46, 96; getPreviewContent dead (cms.ts:202-216) |
| 5 | Publish promotes drafts + clears draftValue | PARTIAL (whole-page clear, fine for v1) | cms.ts:281-289 |
| 6 | Seed must not reset content | MATCHES | cms.ts:143-152 |
| 7 | Keep both ids; isolate by projectId; no id → no query | MATCHES | cms.ts:67-80, all consumers |

---

## Prioritized fix list — mapped to Phase C task ids

**P1 — `rendering+crash` (real behavioral gap, spec-violating):**
Preview/edit mode does not crash when a field is missing from BOTH draft and published; it silently falls back to DOM/children text (`useCmsPage.jsx:46`, `:96`). Fix: in edit/preview mode, source values from `getPreviewContent` (the merged `draft ?? published` map) and throw on absent keys, mirroring the public-path `hasOwnProperty` guard (`useCmsPage.jsx:50-52`, `:98-100`). This also activates the currently-dead `getPreviewContent` query (`cms.ts:202-216`), wiring `CmsContentProvider`/`useCmsPage` to call it when `edit=1`.

**P2 — `discovery idempotency` (`lastSeenAt` missing):**
No `lastSeenAt` exists. Fix: add `lastSeenAt: v.optional(v.number())` to `pageContent` (`schema.ts:18-26`); set it in the `seedDiscoveredFields` patch (`cms.ts:236-238`) and forward it through `upsertPageContent` (`cms.ts:87-105`). The overwrite guards (`cms.ts:233`, `:236-238`) are already correct — this is the only missing piece of requirement 2.

**P3 — `discovery idempotency` (defense-in-depth, optional for v1):**
Non-editable/container filtering is client-side only (`main.jsx:61`). The mutation has no `editable` flag (`cms.ts:24-29`). Fix (optional): have the bridge omit non-editable fields from the discovery payload, or add an `editable` field to `discoveredFieldsValidator` and skip non-editable in the seed loop. Acceptable to defer since the editor is the only caller.

**No change required (verified correct for v1):**
- `edit-draft-only` — `saveDraft` writes only `draftFields` (`cms.ts:262-265`). MATCHES.
- `publish-clears-drafts` — `publishPage` promotes `{...published, ...draft}` and resets `draftFields: {}` (`cms.ts:281-287`); equivalent to per-field clear for whole-page v1 publish. MATCHES for v1.
- `seed-no-reset` — `ensureSeedData` never patches existing `pageContent` (`cms.ts:143-152`). MATCHES.
