# CMS Authoring Guide for LLMs

Use this guide when converting a public website so Avantech CMS can edit it.

The website owns structure. The CMS owns editable published values.

Code owns:

- routes and page paths
- links and `href`s
- layout and class names
- icons and decorative markup
- section IDs and scroll behavior
- form behavior and business logic
- which pages, fields, and collections exist

Convex owns:

```text
pageContent.publishedFields[fieldId] -> string
pageContent.draftFields[fieldId] -> string
collectionItems.publishedData / draftData
```

## Current Shape

The current CMS has three pieces:

1. **Admin project row** in the CMS.
2. **Website integration** in the public site.
3. **Editor bridge** loaded only when the CMS opens the site in edit mode.

The admin row tells the CMS where to load the site:

```ts
{
  slug: "servir-avec-compassion",
  name: "Servir avec Compassion",
  origin: "https://servir-avec-compassion.vercel.app",
  editUrl: "https://servir-avec-compassion.vercel.app"
}
```

The website tells the CMS what pages and fields exist. Do not create website pages in
the CMS admin. Pages are code-owned.

## Requirements

The public site needs:

- Vite, Next, or another browser app that can load the CMS bridge.
- React, Preact with React compat, or equivalent client components.
- `convex` package.
- `VITE_CONVEX_URL` pointing to the CMS Convex deployment.
- `/bridge.js` served by the website.
- A project slug matching the CMS admin project row.
- Page declarations with stable `slug`, `title`, and `path`.
- Stable `data-cms-field` attributes on editable DOM leaves.

The public site does **not** need:

- a local `/convex` folder
- `convex/_generated/api.js`
- CMS schema ownership
- a CMS-side page builder

Use string public function references from external sites:

```ts
useQuery("cms:getPublishedContent", { projectSlug, pageSlug });
```

Do not import generated backend files from the CMS repo into an external public
site.

## Environment

Local `.env.local` for a website:

```env
VITE_CONVEX_URL=https://healthy-fox-966.convex.cloud
```

For Vercel, set the same variable in the website project:

- local/dev: CMS dev Convex URL
- production: CMS production Convex URL

The CMS app itself also needs its own `VITE_CONVEX_URL`. The website and CMS must
point at the same Convex deployment for the environment being tested.

## Project Registration

Before editing a site, create or update its project row in:

```text
/admin/projects
```

For local testing:

```ts
{
  slug: "servir-avec-compassion",
  name: "Servir avec Compassion",
  origin: "http://localhost:3004",
  editUrl: "http://localhost:3004"
}
```

For production:

```ts
{
  slug: "servir-avec-compassion",
  name: "Servir avec Compassion",
  origin: "https://servir-avec-compassion.vercel.app",
  editUrl: "https://servir-avec-compassion.vercel.app"
}
```

The `slug` is the content identity. Keep it stable. Paths can change; slugs should
not change without a content migration.

## Bridge Asset

Copy the current bridge into the public site:

```text
public/bridge.js
```

Source in this repo:

```text
packages/cms-bridge/bridge.js
```

The site should load it only in edit mode:

```ts
function useEditBridge() {
  useEffect(() => {
    if (new URLSearchParams(location.search).get("edit") !== "1") return;
    if (document.querySelector('script[data-cms-bridge="true"]')) return;

    const script = document.createElement("script");
    script.src = "/bridge.js";
    script.dataset.cmsBridge = "true";
    document.body.append(script);
  }, []);
}
```

The CMS will open the site with:

```text
?edit=1&parent=<cms-origin>
```

## Page Registry

Declare pages in the website. This is the source of truth.

```ts
const PAGES = [
  { slug: "home", title: "Home", path: "/" },
  { slug: "pricing", title: "Pricing", path: "/pricing" },
];
```

Register them for the bridge:

```ts
function CmsPagesProvider({ pages, children }) {
  useEffect(() => {
    window.__AVANTECH_CMS_PAGES__ = pages;
    window.dispatchEvent(new CustomEvent("cms:pages-changed", { detail: pages }));

    return () => {
      if (window.__AVANTECH_CMS_PAGES__ === pages) {
        delete window.__AVANTECH_CMS_PAGES__;
      }
    };
  }, [pages]);

  return children;
}
```

For a one-page site, this is enough:

```ts
const PAGES = [{ slug: "home", title: "Home", path: "/" }];
```

## Runtime Wrapper

Wrap the public app in a Convex provider and CMS runtime. React and Preact both
work if the site aliases React correctly.

Minimal React shape:

```tsx
import { ConvexProvider, ConvexReactClient, useQuery } from "convex/react";

const PROJECT_SLUG = "servir-avec-compassion";
const PAGE_SLUG = "home";
const convexClient = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

function CmsRuntime({ children }) {
  useEditBridge();

  return (
    <CmsPagesProvider pages={[{ slug: PAGE_SLUG, title: "Home", path: "/" }]}>
      <CmsContentProvider projectSlug={PROJECT_SLUG} pageSlug={PAGE_SLUG}>
        {children}
      </CmsContentProvider>
    </CmsPagesProvider>
  );
}

function Root() {
  return (
    <ConvexProvider client={convexClient}>
      <CmsRuntime>
        <App />
      </CmsRuntime>
    </ConvexProvider>
  );
}
```

External sites should keep this adapter local to the website or import it from a
real package once one exists. Do not import `examples/shared/useCmsPage.jsx` by
relative filesystem path in production apps.

## Public Content Reads

In public mode, the site reads published fields:

```ts
const publishedFields = useQuery("cms:getPublishedContent", {
  projectSlug,
  pageSlug,
});
```

For text fields, render source text while loading or in edit mode. After the query
loads, render the published value.

Strict behavior is preferred for production:

```tsx
function CmsText({ fieldId, children }) {
  const cms = useContext(CmsContentContext);
  if (!cms || isEditMode() || !cms.isLoaded) return <>{children}</>;
  if (!Object.hasOwn(cms.fields, fieldId)) {
    throw new Error(`Missing published CMS value for ${cms.projectSlug}/${cms.pageSlug}:${fieldId}`);
  }
  return <>{cms.fields[fieldId]}</>;
}
```

During early integration, a temporary fallback is acceptable:

```tsx
return <>{cms.fields?.[fieldId] ?? children}</>;
```

Before production, either seed/publish all fields or switch to strict mode so
missing content is visible.

## Text Fields

Put `data-cms-field` on the editable text leaf.

Good:

```tsx
<a href="#services">
  <span data-cms-field="hero.ctaPrimary">
    <CmsText fieldId="hero.ctaPrimary">Contact us</CmsText>
  </span>
  <span aria-hidden="true">→</span>
</a>
```

Also acceptable if your runtime applies published DOM values directly:

```tsx
<span data-cms-field="hero.ctaPrimary">Contact us</span>
```

Do not put a CMS field on a structural parent that contains other CMS fields:

```tsx
// Avoid
<h1 data-cms-field="hero.title">
  <span data-cms-field="hero.titleLead">Caring for seniors,</span>
  <em data-cms-field="hero.titleEmphasis">with compassion.</em>
</h1>
```

Use:

```tsx
<h1>
  <span data-cms-field="hero.titleLead">Caring for seniors,</span>
  <em data-cms-field="hero.titleEmphasis">with compassion.</em>
</h1>
```

## Image Fields

Images can be editable. Mark the actual `img`:

```tsx
<img
  data-cms-field="hero.image"
  src="/hero-photo.webp"
  alt="Older adult and caregiver in a sunlit living room"
/>
```

The CMS stores uploaded image drafts as canonical Convex storage references and
returns resolved URLs to the iframe/public reader. Keep `alt`, dimensions,
loading, and layout behavior in code for v1.

## Field IDs

Use stable flat IDs:

```text
header.brand
header.cta
hero.kicker
hero.headlineLead
hero.headlineEmphasis
hero.subhead
hero.image
services.1.title
services.1.body
contactCta.headingLead
contactCta.headingEmphasis
```

Rules:

- Use ASCII field IDs.
- Prefer dot-separated names.
- Keep IDs stable across deployments.
- Do not encode page paths into field IDs unless necessary.
- Do not rename a field ID unless you migrate/copy existing content.

## Links and Buttons

CMS owns labels only. Code owns behavior.

```tsx
<a href="#contact">
  <span data-cms-field="nav.contact">Contact</span>
</a>
```

Do not store these in CMS content for v1:

- `href`
- route paths
- button `type`
- event handlers
- section IDs
- ARIA behavior

## Repeated Static Lists

For static marketing lists, use deterministic field IDs.

```tsx
const SERVICES = [
  { id: "companionship" },
  { id: "meals" },
];

{SERVICES.map((service) => (
  <article key={service.id}>
    <h3 data-cms-field={`services.${service.id}.title`}>
      {t(`services.${service.id}.title`)}
    </h3>
    <p data-cms-field={`services.${service.id}.body`}>
      {t(`services.${service.id}.body`)}
    </p>
  </article>
))}
```

Do not use array indexes if the order may change. Use stable item IDs.

## Collections

Collections are for repeated content records that owners create/edit, such as
case studies or team members.

Do not use collections for static marketing lists until the owner needs to create
or reorder records.

When using collections, the website still owns the collection schema. The CMS
only stores record data and renders an editor from the website-provided schema.

Collection identity:

```text
projectSlug + collectionKey + recordSlug
```

Collections are not required for a normal landing page integration.

### Collection Runtime

Read records from Convex with a string function reference:

```tsx
function useCmsCollection(projectSlug: string, collectionKey: string) {
  const query = isEditMode()
    ? "cms:listPreviewCollectionItems"
    : "cms:listPublishedCollectionItems";

  return useQuery(query, { projectSlug, collectionKey }) ?? [];
}
```

In edit mode, use the preview query so draft record data appears before publish.
In public mode, use the published query.

### Collection Provider

Register collection definitions with the bridge:

```tsx
function CmsCollectionsProvider({ collections, children }) {
  useEffect(() => {
    window.__AVANTECH_CMS_COLLECTIONS__ = collections;
    window.dispatchEvent(
      new CustomEvent("cms:collections-changed", { detail: collections }),
    );

    return () => {
      if (window.__AVANTECH_CMS_COLLECTIONS__ === collections) {
        delete window.__AVANTECH_CMS_COLLECTIONS__;
      }
    };
  }, [collections]);

  return children;
}
```

Wrap the site content that renders collection records:

```tsx
function Site() {
  const caseStudies = useCmsCollection(PROJECT_SLUG, "caseStudies");
  const collections = [
    { ...CASE_STUDIES_COLLECTION, recordCount: caseStudies.length },
  ];

  return (
    <CmsCollectionsProvider collections={collections}>
      <CaseStudies records={caseStudies} />
    </CmsCollectionsProvider>
  );
}
```

### Collection Definition

Example:

```ts
const CASE_STUDIES_COLLECTION = {
  key: "caseStudies",
  label: "Case studies",
  titlePath: "title",
  slugPath: "slug",
  defaultItem: {
    title: "",
    client: "",
    industry: "SaaS",
    summary: "",
    cover: "/images/case-study-cover.png",
    featured: false,
  },
  fields: [
    { path: "title", label: "Title", type: "text" },
    { path: "client", label: "Client", type: "text" },
    {
      path: "industry",
      label: "Industry",
      type: "select",
      options: ["SaaS", "Finance", "Healthcare", "Retail"],
    },
    { path: "summary", label: "Summary", type: "longText" },
    { path: "cover", label: "Cover image", type: "image" },
    { path: "featured", label: "Featured on homepage", type: "boolean" },
  ],
};
```

Supported field types in the current editor:

```text
text
longText
select
boolean
number
image
file
object
list
```

For nested objects:

```ts
{
  path: "metadata",
  label: "Metadata",
  type: "object",
  fields: [
    { path: "seoTitle", label: "SEO title", type: "text" },
    { path: "seoDescription", label: "SEO description", type: "longText" },
  ],
}
```

For lists:

```ts
{
  path: "results",
  label: "Results",
  type: "list",
  defaultItem: { label: "", value: "" },
  itemFields: [
    { path: "label", label: "Label", type: "text" },
    { path: "value", label: "Value", type: "text" },
  ],
}
```

### Rendering Collection Records

Render records from the collection query. Mark each record root with
`data-cms-record`.

```tsx
function CaseStudies({ records }) {
  return (
    <section id="cases">
      {records.map((record) => (
        <article
          key={record.slug}
          data-cms-record={`caseStudies:${record.slug}`}
        >
          <img src={record.data.cover} alt="" />
          <span>{record.data.industry}</span>
          <h3>{record.data.title}</h3>
          <p>{record.data.client}</p>
          <p>{record.data.summary}</p>
        </article>
      ))}
    </section>
  );
}
```

The bridge uses `data-cms-record` for click selection and draft record markers.

Format:

```text
data-cms-record="<collectionKey>:<recordSlug>"
```

### Collection Rules

- Keep `collection.key` stable.
- Keep record slugs stable.
- Keep field paths stable once records are published.
- Use `defaultItem` so new records have a complete shape.
- Use `titlePath` so the CMS can label records in the browser panel.
- Keep record layout and card composition in code.
- Store owner-editable record data in the collection item.
- Store route behavior and links in code unless the collection record truly owns
  that content.
- Do not use collections for one-off sections.
- Do not use page `data-cms-field` IDs for collection record fields; collection
  records are edited through the record panel.

## Language Handling

The current CMS stores one value per `projectSlug + pageSlug + fieldId`.

For multilingual sites, choose one v1 policy:

1. **Single authoring language**: force the site language while editing, usually
   French for a French-first site.
2. **Language-scoped field IDs**: include language in the field ID, such as
   `fr.hero.title` and `en.hero.title`.

Do not let browser language detection randomly decide what gets seeded in
production. That can seed English fields into a French-first project or the
reverse.

## Local End-to-End Test

1. Run CMS dev server.
2. Run target website dev server.
3. Create/update project row in `/admin/projects`.
4. Open `/cms/<projectSlug>`.
5. Confirm the iframe loads.
6. Confirm the site reports pages.
7. Click a text field and edit it.
8. Publish.
9. Open the public site without `?edit=1`.
10. Confirm the published value renders.

Example local project row:

```ts
{
  slug: "servir-avec-compassion",
  name: "Servir avec Compassion",
  origin: "http://localhost:3004",
  editUrl: "http://localhost:3004"
}
```

Example editor URL:

```text
http://localhost:3002/cms/servir-avec-compassion
```

## Vercel End-to-End Test

For a deployed website:

1. Deploy the CMS to Vercel.
2. Deploy the website to Vercel.
3. Set the website `VITE_CONVEX_URL` to the CMS Convex deployment.
4. Ensure the website serves `/bridge.js`.
5. Add the production project row in CMS admin.
6. Open `/cms/<projectSlug>` in the CMS deployment.
7. Confirm the Vercel site iframe loads.
8. Edit and publish a field.
9. Visit the Vercel website directly and confirm the published value.

Production project row:

```ts
{
  slug: "servir-avec-compassion",
  name: "Servir avec Compassion",
  origin: "https://servir-avec-compassion.vercel.app",
  editUrl: "https://servir-avec-compassion.vercel.app"
}
```

## Conversion Checklist

1. Install `convex` in the website.
2. Add `VITE_CONVEX_URL`.
3. Copy `packages/cms-bridge/bridge.js` to `public/bridge.js`.
4. Add a project slug matching the CMS admin row.
5. Add page declarations.
6. Register pages with `window.__AVANTECH_CMS_PAGES__`.
7. Wrap the app with `ConvexProvider`.
8. Load the edit bridge only when `?edit=1`.
9. Read `cms:getPublishedContent` with a string function reference.
10. Mark editable text leaves with `data-cms-field`.
11. Mark editable images on the `img` element.
12. Preserve links, routes, IDs, icons, and behavior in code.
13. If collections are needed, declare collection definitions.
14. If collections are needed, register them with `CmsCollectionsProvider`.
15. If collections are needed, render record roots with `data-cms-record`.
16. Register the project in `/admin/projects`.
17. Open the project through `/cms/<projectSlug>`.
18. Confirm pages and fields seed.
19. Confirm collection definitions/records appear when applicable.
20. Publish.
21. Confirm the direct public site renders published content.

## Common Mistakes

- Importing `convex/_generated/api.js` from the CMS repo into the public site.
- Forgetting to serve `/bridge.js`.
- Marking a parent element that contains nested CMS fields.
- Letting browser language detection seed the wrong language.
- Changing field IDs after content has been published.
- Registering Vercel preview URLs as the canonical production project.
- Trying to create pages from the CMS admin.
- Storing `href` or route behavior in CMS text fields.
