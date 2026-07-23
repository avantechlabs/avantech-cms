# Debug Report: Recursive CMS Preview Chrome

Date: 2026-07-23

## Symptom

The CMS editor appeared recursively nested inside itself. The screenshot showed the sidebar, top controls, preview frame, and bottom publish bar repeated several times with slight offsets.

## Root Cause

The editor preview iframe was pointed back at the CMS application instead of a public customer site.

The bad path was:

1. A project had `siteUrl` set to the CMS origin.
2. `useCmsProject` built the iframe URL from `project.siteUrl`.
3. Because the URL resolved to the same origin as `window.location.origin`, the preview iframe loaded the CMS app again.
4. That nested CMS rendered another preview iframe, producing the repeated editor chrome.

In short: the preview boundary trusted project configuration too much. The iframe URL builder allowed the CMS to preview itself.

## Fix Applied

Changed `src/hooks/useCmsProject.ts`:

- Added `buildPreviewTarget`.
- Builds `previewOrigin`, `siteUrl`, and `previewError` together from the same parsed URL.
- Rejects preview targets whose origin equals the CMS origin.
- Returns a clear error: `Site URL points to the CMS. Set it to the public site URL in settings.`

Changed `src/cms/editor/sections/previewFrame/PreviewFrame.tsx`:

- Accepts `previewError`.
- Shows the error in the preview frame instead of rendering an iframe when no safe URL exists.
- Uses `role="alert"` for configuration errors and `role="status"` while loading.

Changed `src/main.jsx`:

- Passes `previewError` from `useCmsProject` into `PreviewFrame`.

Changed `src/hooks/useCmsProject.test.jsx`:

- Keeps coverage for normal external public-site preview URLs.
- Adds regression coverage that blocks same-origin CMS preview URLs.

## Verification

Commands run:

```bash
pnpm exec vitest run src/hooks/useCmsProject.test.jsx
pnpm test
pnpm run build
git diff --check
```

Results:

- Targeted hook tests passed: 2 tests.
- Full test suite passed: 12 files, 95 tests.
- Production build passed.
- Diff whitespace check passed.

## Patterns to Avoid

- Do not iframe the CMS origin inside the CMS. Any preview URL resolving to `window.location.origin` should be treated as invalid unless there is a deliberate, reviewed exception.
- Do not store CMS URLs as project `siteUrl` values. `siteUrl` must point to the public editable site, for example a local public-site dev port or the production public site.
- Do not derive preview URL pieces independently. `previewOrigin`, iframe `siteUrl`, and any preview error state should come from one URL-building function so they cannot drift.
- Do not silently fall back from a bad preview URL to `/` on the current origin. That turns misconfiguration into recursive rendering.
- Do not fix this kind of visual bug with CSS offsets, z-index changes, or hiding extra chrome. Nested chrome means the wrong document is loaded, not that the layout needs masking.
- Do not accept raw admin-entered URLs without validating the runtime behavior they create. Project settings are configuration, but iframe boundaries need runtime guards.

## Operational Note

If this appears again, first inspect the affected project's `siteUrl`. In local development, it should be one of the public site ports listed in `docs/cms-environments.md`, not the CMS port.

## Follow-up: Project URL Contract Mismatch

Date: 2026-07-23

After the preview fix, saving a project's settings failed with this Convex error:

```text
ArgumentValidationError: Object is missing the required field `editUrl`.
Object: {name: "Avantech", siteUrl: "http://localhost:51731/", slug: "project-a"}
Validator: v.object({editUrl: v.string(), name: v.string(), origin: v.string(), slug: v.string()})
```

The browser also showed `contentscript.js` `MaxListenersExceededWarning` and `ObjectMultiplex` messages. Those came from a browser extension content script and were not the app failure. The real app failure was the Convex mutation error.

### Root Cause

The project URL field rename from `origin` / `editUrl` to `siteUrl` had been applied locally, but the active dev Convex deployment and existing database rows still used the old fields.

Confirmed facts:

- Active `cms:updateProject` validator expected `origin` and `editUrl`.
- Remote `projects` rows had `origin` and `editUrl`, not `siteUrl`.
- Local UI was sending only `siteUrl`.

This was a migration problem, not a React problem.

### Fix Applied

Used a safe migration-window shape:

- `convex/schema.ts` now allows `origin`, `editUrl`, and `siteUrl` as optional fields.
- `convex/_cms/projects.ts` accepts either old or new payloads and dual-writes all three URL fields.
- `src/cms/views/SiteSettings.jsx` keeps one visible Site URL field but sends `origin` and `editUrl`, so it is compatible with the old runtime validator during rollout.
- `src/hooks/useCmsProject.ts` reads `siteUrl` with fallback to `editUrl` and `origin`, so existing rows preview correctly.
- `src/cms/shell/AppShell.jsx` uses the same fallback for displaying project hosts.
- Added tests for legacy `origin` / `editUrl` payloads and legacy project rows.
- Ran `npx convex dev --once --typecheck disable` to push the widened contract to the dev Convex deployment.

### Verification

Commands run:

```bash
npx convex function-spec --file
pnpm exec vitest run src/hooks/useCmsProject.test.jsx convex/cms.test.ts
pnpm test
pnpm run build
git diff --check
```

Results:

- Live `cms:createProject` and `cms:updateProject` specs now accept optional `origin`, `editUrl`, and `siteUrl`.
- Targeted tests passed: 2 files, 43 tests.
- Full test suite passed: 12 files, 97 tests.
- Production build passed.
- Diff whitespace check passed.

The CLI could not call `cms:updateProject` directly because the mutation correctly requires an authenticated admin session. Use the browser's signed-in CMS session to retry the save.

### Patterns to Avoid

- Do not rename persisted Convex fields directly from required old fields to a required new field while rows still exist in the old shape.
- Do not deploy client code that sends a new mutation payload before the active Convex deployment accepts it.
- Do not make the schema narrower before backfilling existing rows.
- Do not treat browser extension `contentscript.js` warnings as app root cause when a first-party Convex error is present.
- During field migrations, prefer widen, dual-read, dual-write, deploy, backfill, then narrow in a later change.

## Follow-up: Production Auth Sign-In Server Error

Date: 2026-07-23

After deploying the CMS frontend to production, the browser console showed:

```text
[CONVEX A(auth:signIn)] Server Error
```

The console also showed `/favicon.ico` 404 and `inject.bundle.js` /
`runtime.lastError` messages. Those were not the app failure. The real app
failure was the Convex `auth:signIn` action.

### Root Cause

Production Vercel was correctly pointing at the production Convex URL:

```text
https://shocking-boar-256.convex.cloud
```

But the production Convex deployment was not fully initialized for CMS auth.

Confirmed facts:

- Production Convex logs showed `auth:signIn` throwing `InvalidAccountId`.
- Production `authAccounts` and `users` tables were empty.
- Production Convex had no auth env vars set.
- Production Convex functions were stale before the fix; project mutations still
  had the old `origin` / `editUrl` required contract.

The immediate sign-in error meant the submitted password account did not exist
in production. A dev CMS account does not carry over to the production Convex
deployment.

### Fix Applied

- Set production Convex Auth env vars on `shocking-boar-256`:
  - `CMS_ADMIN_EMAIL`
  - `SITE_URL`
  - `JWT_PRIVATE_KEY`
  - `JWKS`
- Used a fresh production JWT keypair.
- Deployed current Convex functions to production with:

```bash
npx convex deploy --typecheck disable --message "Initialize production CMS auth and schema" --yes
```

### Verification

Commands run:

```bash
npx convex logs --prod --history 20
npx convex env --prod list
npx convex data --prod authAccounts --limit 5 --format jsonArray
npx convex data --prod users --limit 5 --format jsonArray
npx convex function-spec --prod
```

Results:

- Production env vars are now present.
- Production functions deployed successfully.
- Production function spec now includes the widened `siteUrl` project contract.
- Production `authAccounts` and `users` are still empty until the first real
  production account is created.

### Required First-Use Step

On production, use **Create account** once with the configured admin email.
After that, normal **Sign in** should work for that production account.

### Patterns to Avoid

- Do not expect dev Convex auth users to exist in production Convex.
- Do not ship a production frontend pointed at a new Convex deployment before
  that deployment has auth env vars and current functions deployed.
- Do not treat `InvalidAccountId` as a frontend bug. It means Convex Auth could
  not find a password account for the submitted email.

## Follow-up: Public Sites Reading Dev CMS

Date: 2026-07-23

Production CMS edits did not appear on the public sites even after the CMS admin
was writing to production Convex.

### Root Cause

The public site frontends read `VITE_CONVEX_URL` at Vite build time. Their
production Vercel environment was stale or empty:

- `cleaning` production had `VITE_CONVEX_URL` set to the dev Convex deployment,
  `https://healthy-fox-966.convex.cloud`.
- `servir-avec-compassion` production had an empty `VITE_CONVEX_URL`.

The CMS production backend is:

```text
https://shocking-boar-256.convex.cloud
```

Changing Vercel env vars does not change already-built JavaScript bundles. The
public sites also had to be rebuilt/redeployed after the env fix.

### Fix Applied

Updated the production `VITE_CONVEX_URL` env var to
`https://shocking-boar-256.convex.cloud` for:

- Vercel project `cleaning`
- Vercel project `servir-avec-compassion`

Redeployed the latest existing production deployments through Vercel CLI so the
dirty local working trees in those site repos were not shipped.

New production deployments:

- `cleaning`: `https://cleaning-kgryzvsyx-shamiivans-projects.vercel.app`
- `servir-avec-compassion`:
  `https://servir-avec-compassion-lnk469upa-shamiivans-projects.vercel.app`

### Verification

Commands run:

```bash
vercel pull --yes --environment=production
vercel inspect https://cleaning-kgryzvsyx-shamiivans-projects.vercel.app
vercel inspect https://servir-avec-compassion-lnk469upa-shamiivans-projects.vercel.app
```

Results:

- `pinkexterior.ca` live bundle includes `shocking-boar-256.convex.cloud`.
- `pinkexterior.ca` live bundle does not include `healthy-fox-966.convex.cloud`.
- `www.serviraveccompassion.ca` live bundle includes
  `shocking-boar-256.convex.cloud`.
- `www.serviraveccompassion.ca` live bundle does not include
  `healthy-fox-966.convex.cloud`.

### Related Findings

Production CMS currently has project rows for `pink` and
`servir-avec-compassion`. `endocafe` and `directive-films` have CMS runtime
hooks in their site code, but production CMS does not currently have matching
project rows for those slugs.

### Patterns to Avoid

- Do not assume a public site reads from the same Convex deployment as the CMS
  admin. Each Vercel project has its own build-time environment.
- Do not expect Vercel env changes to affect already-built frontend bundles.
  Redeploy after changing `VITE_` env vars.
- Do not deploy public sites from a dirty local checkout when the goal is only
  to refresh production env. Redeploy an existing production deployment instead.
