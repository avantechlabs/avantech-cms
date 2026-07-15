# Site Owner Publish Drafts Diagnosis

## Symptom

User reports: "A site owner can publish drafts for an assigned site" is not working.

## Local Findings

- `AGENTS/DEBUG/DEBUG.md` is empty.
- Backend publish mutation is `api.cms.publishSite`.
- Frontend publish button calls `onPublish` in `src/main.jsx`.
- `onPublish` calls `publish()` from `src/hooks/useFieldManager.ts`.
- `publish()` waits for the latest pending save, then calls `publishSite({ projectSlug, pageSlug, language })`.
- `publishSite` in `convex/_cms/publish.ts` checks `requireSiteAccess(ctx, project)`, not `requireAdmin`.

## Verification Run

Command:

```bash
pnpm test convex/cms.test.ts src/hooks/useFieldManager.test.jsx
```

Result:

- 2 test files passed.
- 40 tests passed.

The existing backend test `site owners can load editor state and publish or discard assigned site drafts` covers:

- admin assigns owner
- owner loads editor state
- owner saves draft
- owner publishes site
- public content reflects owner draft
- owner can discard later draft

## Deployment Sync

Command:

```bash
npx convex dev --once
```

Result:

- Convex functions ready.

## Current Diagnosis

Local source and focused tests show site-owner publishing is allowed by the backend.

Most likely causes if the browser still fails:

1. Browser was hitting stale Convex deployment code before `npx convex dev --once`.
2. The signed-in user's email does not exactly normalize to a `siteMembers.email` row for that project.
3. The publish mutation is failing at runtime, but the frontend does not catch the rejected promise in `onPublish`, so the UI does not show a useful error.

## Recommended Next Check

If it still fails after hard refresh, capture the browser console error for the publish click. The stack trace should identify whether the failing function is:

- `cms:publishSite`, which means backend auth/data issue;
- `cms:saveDraft`, which means the draft never saved before publish;
- another mutation/query, which means the visible failure is adjacent to publish but not publish itself.
