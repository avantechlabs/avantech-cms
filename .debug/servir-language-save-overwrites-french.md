# Servir Language Save Overwrites French

## Symptom

When editing the English version of `servir-avec-compassion`, French content can appear to be replaced by English content.

## Diagnosis

The backend content model is language-aware:

- Unscoped legacy/default fields live in `publishedFields` and `draftFields`.
- Language-specific fields live in `publishedFieldsByLanguage` and `draftFieldsByLanguage`.
- Reads for a selected language merge default published fields with that language's overrides.

`useFieldManager` already passed the selected editor language into normal page draft saves, publishes, and discards. The missing path was field discovery: the hook returned the raw `seedDiscoveredFields` mutation, and `CmsEditor` called it without `language`.

That means when the iframe was showing English and reported its discovered fields, those English values could be written into the unscoped/default published fields. French reads those default fields as its base, so English discovery could affect French output.

## Fix

`useFieldManager` now wraps `seedDiscoveredFields` and always sends the hook's current `projectSlug`, `pageSlug`, and `language` with discovered fields.

## Regression Test

Added a hook-level test proving discovered fields are seeded with the selected editor language.

## Verification

- `pnpm test src/hooks/useFieldManager.test.jsx`
- `pnpm test src/hooks/useFieldManager.test.jsx src/hooks/useCmsProject.test.jsx src/hooks/useIframeMessaging.test.jsx`
- `pnpm test convex/cms.test.ts`
- `pnpm build`
