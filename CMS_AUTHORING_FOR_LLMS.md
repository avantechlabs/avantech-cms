# CMS Authoring Guide for LLMs

Use this guide when writing or converting a public React/Vite website for this CMS prototype.

## Goal

The public site must render content from Convex `publishedFields`.

Code owns structure:

- routes
- links and `href`s
- layout
- class names
- icons
- section IDs
- business logic

Convex owns editable text content:

```text
publishedFields[fieldId]
```

## Requirements

The public site needs:

- React.
- `convex` package.
- `VITE_CONVEX_URL` in the site root `.env.local`.
- A deployed Convex backend that exposes the public query:

  ```text
  cms:getPublishedContent
  ```

The public site does **not** need the local `/convex` folder or `convex/_generated/api.js`.

No Convex schema change is required for this authoring model. The data model stays the existing page-level flat maps:

```text
pageContent.publishedFields: fieldId -> value
pageContent.draftFields: fieldId -> value
```

`<CmsText>` changes how React code declares and reads fields. It does not introduce collections, per-field rows, or a new nested content schema.

Example `.env.local`:

```env
VITE_CONVEX_URL=https://healthy-fox-966.convex.cloud
VITE_CONVEX_SITE_URL=https://healthy-fox-966.convex.site
```

## Runtime Wrapper

Wrap the site in a Convex provider and CMS content provider:

```jsx
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { CmsContentProvider } from "../shared/useCmsPage.jsx";

const PROJECT_SLUG = "project-a";
const PAGE_SLUG = "home";
const convexUrl = import.meta.env.VITE_CONVEX_URL;

function SiteApp() {
  if (!convexUrl) {
    throw new Error("Set VITE_CONVEX_URL to render CMS content from Convex.");
  }

  const convex = new ConvexReactClient(convexUrl);

  return (
    <ConvexProvider client={convex}>
      <CmsContentProvider projectSlug={PROJECT_SLUG} pageSlug={PAGE_SLUG}>
        <Site />
      </CmsContentProvider>
    </ConvexProvider>
  );
}

createRoot(document.getElementById("root")).render(<SiteApp />);
```

## Text Authoring

Wrap user-facing literal text with `<CmsText>`.

```jsx
import { CmsText } from "../shared/useCmsPage.jsx";
```

Good:

```jsx
<a href="#features" data-cms-field="nav.features">
  <CmsText fieldId="nav.features">Features</CmsText>
</a>
```

The `data-cms-field` attribute and `fieldId` should usually match.

The JSX children are the setup/discovery seed value. Public runtime renders the Convex published value.

## Field IDs

Use stable flat field IDs:

```text
nav.features
nav.howItWorks
hero.eyebrow
hero.title
hero.subtitle
hero.cta
features.1.title
features.1.desc
cta.primary
footer.copy
```

Do not use collection objects or arrays for V1:

```jsx
// Avoid
fields.collections.features[0].title
```

Prefer:

```jsx
<CmsText fieldId="features.1.title">Invoice on-site</CmsText>
```

## Nested Markup

Preserve structure tags and wrap the deepest editable text leaves.

Before:

```jsx
<h1>Every contract,<br /><em>controlled.</em></h1>
```

After:

```jsx
<h1>
  <span data-cms-field="hero.title.prefix">
    <CmsText fieldId="hero.title.prefix">Every contract,</CmsText>
  </span>
  <br />
  <em data-cms-field="hero.title.emphasis">
    <CmsText fieldId="hero.title.emphasis">controlled.</CmsText>
  </em>
</h1>
```

Do not put one CMS field around mixed structural markup unless the whole element should be edited as one plain text field.

## Links and Buttons

Keep behavior in code. Only the label is CMS content.

```jsx
<a href="#pricing" data-cms-field="nav.pricing">
  <CmsText fieldId="nav.pricing">Pricing</CmsText>
</a>
```

```jsx
<button type="button" data-cms-field="form.submit">
  <CmsText fieldId="form.submit">Submit</CmsText>
</button>
```

Do not store `href`, `type`, event handlers, or route IDs in CMS content for V1.

## Dynamic Content

Preserve expressions and wrap only literal text around them.

```jsx
<p>
  {count}{" "}
  <span data-cms-field="stats.customers.label">
    <CmsText fieldId="stats.customers.label">customers</CmsText>
  </span>
</p>
```

Do not convert variables or props unless the developer clearly wants CMS to own that value.

Avoid:

```jsx
<CmsText fieldId="button.label">{label}</CmsText>
```

Prefer leaving it as code:

```jsx
<button>{label}</button>
```

## Repeated Lists

For static marketing lists, use deterministic field IDs from the item number.

```jsx
{FEATURES.map((feature) => (
  <article className="feature-card" key={feature.n}>
    <h3 data-cms-field={`${feature.field}.title`}>
      <CmsText fieldId={`${feature.field}.title`}>{feature.title}</CmsText>
    </h3>
    <p data-cms-field={`${feature.field}.desc`}>
      <CmsText fieldId={`${feature.field}.desc`}>{feature.desc}</CmsText>
    </p>
  </article>
))}
```

Where data uses stable field roots:

```js
const FEATURES = [
  {
    n: "01",
    title: "Invoice on-site",
    desc: "Generate accurate invoices the moment the job is done.",
    field: "features.1",
  },
];
```

## Edit Mode / Discovery

The bridge discovers editable DOM leaves using:

```jsx
data-cms-field="field.id"
```

Rules:

- Put `data-cms-field` on the DOM element that contains the editable text leaf.
- Avoid putting `data-cms-field` only on a parent that contains other CMS fields.
- If a parent is structural, leave it unmarked and mark its text leaves.

Good:

```jsx
<h1>
  <span data-cms-field="hero.title.prefix">
    <CmsText fieldId="hero.title.prefix">Every contract,</CmsText>
  </span>
  <em data-cms-field="hero.title.emphasis">
    <CmsText fieldId="hero.title.emphasis">controlled.</CmsText>
  </em>
</h1>
```

Avoid:

```jsx
<h1 data-cms-field="hero.title">
  <CmsText fieldId="hero.title.prefix">Every contract,</CmsText>
  <em>
    <CmsText fieldId="hero.title.emphasis">controlled.</CmsText>
  </em>
</h1>
```

The parent field would not match the leaf fields cleanly.

## Public Runtime Rules

`CmsText` behavior:

- If no CMS provider exists, render children.
- If `?edit=1`, render children so discovery sees the source/default text.
- While the Convex query is loading, render children.
- After the query loads, render `publishedFields[fieldId]`.
- If `publishedFields[fieldId]` is missing, throw.

That final throw is intentional. Missing published content means discovery/seeding/publishing is broken.

## Common Mistakes

Do not silently fall back forever:

```jsx
// Bad
return fields[fieldId] ?? children;
```

Do not import generated backend files in public external sites:

```jsx
// Avoid for public/external sites
import { api } from "../../../convex/_generated/api.js";
```

Use a string public function reference instead:

```js
useQuery("cms:getPublishedContent", { projectSlug, pageSlug });
```

Do not split an existing field ID without handling old content. If old Convex content has:

```text
hero.title
```

and new JSX reads:

```text
hero.title.prefix
hero.title.emphasis
```

then the old `hero.title` value will no longer render until it is migrated or manually copied.

## Conversion Checklist

1. Add `.env.local` to the site root with `VITE_CONVEX_URL`.
2. Wrap the app in `ConvexProvider`.
3. Wrap the page in `CmsContentProvider`.
4. Import `CmsText`.
5. Wrap user-facing literal text leaves.
6. Add matching `data-cms-field` attributes on editable DOM leaves.
7. Preserve links, structure, icons, route IDs, and expressions in code.
8. Start the site in edit mode through the CMS so fields are discovered and seeded.
9. Publish the page.
10. Visit the public site without `?edit=1` and confirm it renders published content.

## Minimal Example

```jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { CmsContentProvider, CmsText, useEditBridge } from "../shared/useCmsPage.jsx";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

function App() {
  return (
    <ConvexProvider client={convex}>
      <CmsContentProvider projectSlug="project-a" pageSlug="home">
        <Site />
      </CmsContentProvider>
    </ConvexProvider>
  );
}

function Site() {
  useEditBridge();

  return (
    <main>
      <nav>
        <a href="#features" data-cms-field="nav.features">
          <CmsText fieldId="nav.features">Features</CmsText>
        </a>
      </nav>

      <h1 data-cms-field="hero.title">
        <CmsText fieldId="hero.title">Billing that keeps field teams moving.</CmsText>
      </h1>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
```
