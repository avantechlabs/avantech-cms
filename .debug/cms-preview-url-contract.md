# CMS Preview URL / Project Contract Diagnosis

## Symptoms

1. The CMS editor rendered recursively inside its own preview iframe. The visible UI showed repeated sidebars, top controls, preview frames, and bottom publish bars.

2. After changing a project's Site URL in settings, Convex rejected the save:

```txt
ArgumentValidationError: Object is missing the required field `editUrl`.
Object: {name: "Avantech", siteUrl: "http://localhost:51731/", slug: "project-a"}
Validator: v.object({editUrl: v.string(), name: v.string(), origin: v.string(), slug: v.string()})
```

Browser `contentscript.js` warnings about `MaxListenersExceededWarning` and `ObjectMultiplex` came from an extension content script. They were noisy but not the app root cause.

## Root Causes

### Recursive Preview

The preview iframe was allowed to load a URL on the CMS origin. When a project URL pointed back to the CMS app, the iframe loaded another CMS instance, which rendered another iframe, producing nested editor chrome.

The bug was at the iframe boundary, not in CSS layout.

### Convex Contract Mismatch

The project URL model was partially migrated from:

```txt
origin + editUrl
```

to:

```txt
siteUrl
```

Local frontend code sent `siteUrl`, but the active Convex dev deployment and existing `projects` rows still expected/stored `origin` and `editUrl`.

This was a schema/data migration issue, not a React form issue.

## Fixes Applied

- `src/hooks/useCmsProject.ts`
  - Added `buildPreviewTarget`.
  - Blocks iframe URLs whose origin equals `window.location.origin`.
  - Reads project URL using `siteUrl`, falling back to legacy `editUrl` and `origin`.

- `src/cms/editor/sections/previewFrame/PreviewFrame.tsx`
  - Shows a configuration error instead of rendering an unsafe iframe.

- `src/main.jsx`
  - Passes `previewError` into the preview frame.

- `src/cms/views/SiteSettings.jsx`
  - Keeps one visible Site URL field.
  - Sends compatible `origin` and `editUrl` values during the migration window.

- `convex/schema.ts`
  - Widens `projects` to allow optional `origin`, `editUrl`, and `siteUrl`.

- `convex/_cms/projects.ts`
  - Accepts either old or new URL payloads.
  - Dual-writes `origin`, `editUrl`, and `siteUrl`.

- `convex/_cms/shared.ts`
  - Seeded projects now include all three URL fields during the migration window.

## Deployment Sync

Command run:

```bash
npx convex dev --once --typecheck disable
```

Result:

- Dev Convex deployment accepted the widened function/schema contract.
- Live `cms:createProject` and `cms:updateProject` function specs now accept optional `origin`, `editUrl`, and `siteUrl`.

## Verification Run

Commands:

```bash
pnpm exec vitest run src/hooks/useCmsProject.test.jsx convex/cms.test.ts
pnpm test
pnpm run build
git diff --check
```

Results:

- Targeted tests passed: 2 files, 43 tests.
- Full test suite passed: 12 files, 97 tests.
- Production build passed.
- Whitespace check passed.

## Patterns to Avoid

- Do not iframe the CMS origin inside the CMS. A preview URL resolving to `window.location.origin` should be rejected.
- Do not treat repeated editor chrome as a CSS problem. It means the wrong document is loaded in the iframe.
- Do not silently fall back from a bad project URL to `/` on the current origin.
- Do not rename required Convex fields while existing rows still use the old shape.
- Do not deploy client code that sends a new mutation payload before the active Convex deployment accepts that payload.
- Do not narrow Convex schema before backfilling existing data.
- During persisted field migrations, use widen, dual-read, dual-write, deploy, backfill, then narrow later.
- Do not chase extension `contentscript.js` warnings when a first-party Convex error identifies the failing app boundary.

## Next Migration Step

After all deployed clients and rows are confirmed to use `siteUrl`, backfill any remaining rows missing `siteUrl`, then remove legacy `origin` and `editUrl` in a later narrow-schema deploy.
