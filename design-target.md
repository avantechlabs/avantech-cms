# Design Target — Avantech CMS Editor

> Companion to `.impeccable.md`. That file holds the locked context (users, brand,
> spatial model, principles). This file is the **buildable spec**: concrete tokens,
> a component inventory with recede behavior, the parent↔iframe interaction model,
> what to drop, and the visual refinements to make.
>
> Source of feel: `Working/w_2026_5_26/cms-flow.html` (mockup — feel, not markup).
> Interactions are locked to that mockup's model. Visuals are refined here toward a
> calmer, more premium canvas. This doc feeds the Phase D build via
> `frontend-design-impeccable`.

---

## 0. The one thing to internalize first

The mockup edits text inline inside a single self-contained page. **The real CMS
does not.** The customer's live site renders inside an **iframe on a separate
origin**, and the editor chrome lives in the **parent window**. They talk only
through `postMessage` (contract in `src/messages.ts`).

`packages/cms-bridge/bridge.js` is the script injected into the iframe. Today it
already does three things: **field discovery** (`[data-cms-field]` → `{id, value,
editable, rect}`), **DOM mutation** (`applyField` sets `textContent`), and **click
detection** (`cms:field-clicked`). Today's parent edits text in a sidebar
`<textarea>` and pushes it down with `cms:update-field`. That sidebar form is
exactly the "developer tool" the brand context anti-references.

To get the mockup's *edit-in-place* feel, the inline-editing UI has to move
**into the iframe** (contenteditable on the clicked field + a floating selection
toolbar drawn by the bridge), while every other piece of chrome (mode toggle,
bottom bar, rail, side panel) **overlays from the parent**. Section 3 makes this
split explicit. Everything else in this doc assumes that split.

---

## 1. Design Tokens

The mockup's tokens are the starting point. The refinement: **warm the neutrals**
(pure `#fff`/`#111` reads clinical on a full-bleed canvas), **cool and quiet the
gold** so it only ever means "live / act," and **soften shadows** so chrome floats
rather than stamps. Gold `#FDB714` stays the brand accent but is spent only on the
live dot, the Publish button, and the active selection outline — nowhere else.

### 1.1 Color — Light

```css
:root {
  /* Accent — "live / act" only. Never decorative. */
  --gold:            #FDB714;   /* brand gold, kept */
  --gold-press:      #E5A512;   /* hover/active depth */
  --gold-tint:       #FFF6E0;   /* faint wash behind a selected field */
  --gold-ring:       rgba(253, 183, 20, 0.22);  /* focus ring / glow */

  /* Canvas + chrome surfaces — warm neutrals, not pure white */
  --bg:              #FBFAF8;   /* app/stage behind the iframe (warm off-white) */
  --surface:         #FFFFFF;   /* elevated chrome: bars, panels, toolbar */
  --surface-2:       #F4F2EE;   /* hover fills, rail rows, input wells */
  --surface-3:       #ECE9E3;   /* pressed / track */

  /* Text — warm near-black, not #000 */
  --text:            #1A1916;   /* primary */
  --text-2:          #46443E;   /* secondary / body */
  --text-muted:      #76736B;   /* labels, meta, eyebrows */
  --text-dim:        #A6A299;   /* counts, placeholders, disabled */

  /* Hairlines — warm, low-contrast */
  --line:            #E7E3DC;   /* default border */
  --line-strong:     #D8D3CA;   /* input border, dividers under load */

  /* Draft vs live semantics (Principle 2) */
  --draft:           #B7791F;   /* "unpublished change" amber-brown, calmer than gold */
  --draft-tint:      #FBF3E3;   /* draft-changed field wash */
  --live:            #3F8F5B;   /* "this is published / live" green, used sparingly */
}
```

### 1.2 Color — Dark

Dark is the *premium* default for a focus tool, but it must stay warm-neutral, not
the mockup's near-pure `#0d0d0d`. Think warm graphite.

```css
[data-theme="dark"] {
  --gold:            #FDB714;
  --gold-press:      #FFC53D;
  --gold-tint:       rgba(253, 183, 20, 0.10);
  --gold-ring:       rgba(253, 183, 20, 0.30);

  --bg:              #17150F;   /* warm graphite stage */
  --surface:         #201E18;   /* chrome surface */
  --surface-2:       #2A2720;   /* hover */
  --surface-3:       #353128;   /* pressed */

  --text:            #F5F2EA;
  --text-2:          rgba(245, 242, 234, 0.82);
  --text-muted:      rgba(245, 242, 234, 0.56);
  --text-dim:        rgba(245, 242, 234, 0.34);

  --line:            rgba(245, 242, 234, 0.10);
  --line-strong:     rgba(245, 242, 234, 0.18);

  --draft:           #E0A94A;
  --draft-tint:      rgba(224, 169, 74, 0.12);
  --live:            #5FB47C;
}
```

> Note: the **iframe content is the customer's own site** in whatever palette they
> built. The dark/light toggle styles the **chrome only** (bars, panels, rail,
> toolbar). The stage `--bg` shows only as a thin margin around the framed site.
> Don't recolor the iframe.

### 1.3 Typography

Two families, exactly as locked. Inter for everything the user reads and types;
Space Mono only for machine-ish meta (labels, eyebrows, counts, status). Mono is
a *texture* signal — keep it tiny and uppercase, never body copy.

```css
--font-ui:   'Inter', system-ui, sans-serif;   /* UI + editable text */
--font-meta: 'Space Mono', ui-monospace, monospace;  /* labels / eyebrows / counts */
```

| Role | Family | Size / Line | Weight | Tracking | Usage |
|---|---|---|---|---|---|
| Panel title | Inter | 22 / 1.2 | 700 | -0.02em | side-panel / rail header H |
| Section / page H | Inter | 16 / 1.3 | 600 | -0.01em | rail group title, panel subhead |
| UI body | Inter | 14 / 1.5 | 400–500 | 0 | buttons, field labels, panel text |
| Small UI | Inter | 13 / 1.4 | 500 | 0 | bottom-bar buttons, toasts |
| Meta / eyebrow | Space Mono | 11 / 1.2 | 400 | 0.18em | UPPERCASE labels, "EDITING AS…", counts |
| Micro meta | Space Mono | 10 / 1.2 | 400 | 0.20em | rail section labels, field tags |

**Editable text inside the iframe keeps the site's own typography** — the bridge
must not impose Inter on the customer's content. Inter governs chrome and the
selection toolbar; the contenteditable region inherits the site's styles.

### 1.4 Radius

```css
--r-xs:  4px;   /* tags, inline chips */
--r-sm:  6px;   /* toolbar buttons, popover items */
--r-md:  10px;  /* inputs, cards, the selection toolbar */
--r-lg:  14px;  /* side panel inner cards, image wells */
--r-pill: 999px; /* bottom bar, mode toggle, all "floating" controls */
```

Pill for anything that floats over the canvas; soft `--r-md`/`--r-lg` for anything
docked (panel, rail, inputs). This is the mockup's instinct, kept.

### 1.5 Shadow — softer, warmer, lower

Chrome should look like it's resting a few millimetres above the stage, not
punched onto it. Warm-tinted, low-opacity, generous blur.

```css
/* light */
--shadow-sm:  0 1px 2px rgba(40, 34, 20, 0.05);
--shadow-md:  0 4px 16px rgba(40, 34, 20, 0.07);
--shadow-lg:  0 10px 30px rgba(40, 34, 20, 0.09);   /* mode toggle, rail tab */
--shadow-xl:  0 20px 56px rgba(40, 34, 20, 0.12);   /* bottom bar, side panel */
--shadow-pop: 0 2px 6px rgba(40, 34, 20, 0.06), 0 14px 34px rgba(40, 34, 20, 0.14); /* selection toolbar / popovers */

/* dark — ring + deep shadow */
[data-theme="dark"] {
  --shadow-lg:  0 0 0 1px rgba(255,255,255,0.05), 0 12px 32px rgba(0,0,0,0.5);
  --shadow-xl:  0 0 0 1px rgba(255,255,255,0.05), 0 22px 60px rgba(0,0,0,0.6);
  --shadow-pop: 0 0 0 1px rgba(255,255,255,0.06), 0 14px 36px rgba(0,0,0,0.62);
}
```

Drop the mockup's `--shadow-gold` (gold-tinted glow under buttons) — it's
decorative spending of the accent. Gold goes in fills and rings, never in ambient shadow.

### 1.6 Spacing

4px base; an 8px rhythm for most chrome. Tokens, not ad-hoc values.

```css
--s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
--s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 64px;
```

- Bottom bar: `--s-2` inner padding, `--s-4` gap between groups, lifted `--s-5` from bottom.
- Side panel / rail: `--s-6` padding, `--s-5` between field groups.
- Stage margin (gap between viewport edge and the framed iframe): `--s-3`–`--s-5`,
  so the site reads as a *sheet on a stage*, not edge-to-edge chrome.

### 1.7 Motion

Calm means **few things move, slowly, with a soft ease**. One easing curve for
almost everything. Reduce, never spring.

```css
--ease:      cubic-bezier(0.22, 0.61, 0.36, 1);  /* default, gentle ease-out */
--ease-soft: cubic-bezier(0.4, 0.0, 0.2, 1);     /* panel/rail slides */

--dur-fast:  140ms;  /* toolbar appear, hover, button state */
--dur-base:  220ms;  /* toggle, toast, fades */
--dur-panel: 380ms;  /* rail / side-panel slide in-out */
--dur-theme: 320ms;  /* theme cross-fade (chrome only) */
```

Rules:
- The **pulsing live dot** from the mockup: keep, but slow to ~2.4s and reduce the
  opacity swing (1 → 0.6, not 1 → 0.5). It's a heartbeat, not a blink.
- **Honor `prefers-reduced-motion`**: drop the pulse, cut panel slides to a fade,
  no transforms.
- **Kill the publish confetti** (`@keyframes confettiUp` in the mockup). Celebration
  motion contradicts "the tool disappears." Success is a quiet toast + the
  change-count returning to zero (§2.4).

---

## 2. Component Inventory

Each chrome piece below states its **purpose**, **where it lives** (parent vs
iframe), **when it's visible**, and **how it recedes**. The recede behavior is the
whole point — in View mode the chrome should be nearly gone.

Global rule: **two modes drive everything.** `View` = the chrome dissolves and the
site is just a site. `Edit` = chrome fades in. The mode lives in the parent; the
parent tells the bridge via `postMessage` so the iframe can switch its own hover
affordances on/off.

### 2.1 View / Edit mode toggle  *(parent)*

- **Purpose:** the master switch between "looking at my live site" and "changing it."
- **Form:** a small pill, top-right, two segments `View` · `Edit`; the active
  segment fills with `--text` (inverted). The mockup's separate theme button sits
  to its left as an icon.
- **Visible:** always — it's the one piece of chrome that never fully leaves, so
  the owner always has a way back to safety.
- **Recede:** in View mode it dims to ~60% opacity and loses its shadow; on
  pointer-near-top-right (or focus) it returns to full. It's the quietest persistent
  control on screen.
- **Refinement vs mockup:** the mockup's toggle uses Space Mono uppercase micro-text.
  Keep mono, but the labels are plain words (`View` / `Edit`), never jargon.

### 2.2 Floating bottom action bar  *(parent)*

- **Purpose:** the safety-and-publish console. Answers "what's my draft state and
  how do I make it live (or undo it)." This is where Principle 2 (draft vs live) lives.
- **Contents, left→right:**
  1. **Status** — pulsing `--gold` live dot + plain text: `Editing as {name}`.
     When there are unpublished changes, append a calm draft note: `· {n} unpublished`.
  2. divider
  3. **History** — opens a list of past published versions (read + restore). Plain
     language, no diffs/JSON.
  4. **Discard** — reverts all drafts. Always behind a confirm (§3.6). Disabled (dim)
     when change-count is 0.
  5. **Publish** — the only gold-filled button. Carries the **change-count badge**
     (`{n}`) on its left. Disabled/dim at 0; on hover at 0 it explains "Nothing to
     publish yet" rather than doing nothing silently.
- **Visible:** only in Edit mode. Slides up from below + fades in (`--dur-panel`).
- **Recede:** in View mode it slides down 20px and fades out, `pointer-events:none`.
- **Refinement vs mockup:** the count badge reads as a *number of unpublished
  changes*, surfaced in two places (badge on Publish + "{n} unpublished" in status)
  so a non-technical owner can't miss that something is staged. Badge color shifts
  to `--draft` semantics, not pure black-on-gold.

### 2.3 Left collections rail  *(parent)*

- **Purpose:** navigate **Pages**, **Collections**, **Media** — the site's
  structure, in the owner's words.
- **Form:** a thin always-present **rail tab** (40px) hugging the left edge, mid-height;
  click expands a 300–320px drawer over the stage. Groups: `Pages` (Home/About/…),
  `Collections` (Projects · count, Team · count…), `Media` (Images · count…).
- **Visible:** the rail *tab* shows only in Edit mode; the *drawer* opens on click
  and closes on outside-click / Esc / mode-off.
- **Recede:** tab fades out in View mode; drawer is closed by default — navigation
  is on-intent, never a permanent left column (that would be "cockpit," not "canvas").
- **Refinement vs mockup:** counts stay in Space Mono (good machine-meta use). When
  a page has unpublished drafts, mark its row with a small `--draft` dot so the owner
  sees *which* pages have staged changes before publishing. This is new, and it
  directly serves draft-vs-live clarity across pages.

### 2.4 Right side panel  *(parent)*

- **Purpose:** structured / contextual fields that **don't** edit in place — a whole
  record at once (a Project: cover image, title, client, year, story, tags). The
  counterpart to inline text editing: inline for prose on the canvas, panel for
  structured records.
- **Form:** 440px drawer from the right over a faint scrim (`rgba(0,0,0,0.2)` +
  light blur); labeled fields (Inter labels in `--text-muted`), inputs with
  `--r-md`, focus ring in `--gold-ring`. A full-width primary action at the bottom.
- **Visible:** opens when the owner picks a structured record (e.g. clicks a
  collection card surfaced through the bridge as a non-inline `[data-cms-field]`
  container). Closes on Save / scrim / Esc.
- **Recede:** off-canvas by default; scrim makes the rest of the page recede *toward*
  the panel when open, then everything returns.
- **Refinement vs mockup:** the mockup's button says "Save changes." Reframe to the
  draft model: editing a field **stages a draft automatically** (autosave), so the
  panel's primary button is **Done** (close), not "Save" — saving isn't a separate
  act, and nothing here is "live" until Publish. This keeps the whole tool on one
  consistent draft→publish mental model (§3.3).

### 2.5 In-canvas inline selection toolbar  *(iframe — drawn by the bridge)*

- **Purpose:** the Notion-style floating toolbar that appears over a **text
  selection** inside an editable field, for light formatting.
- **Lives in the iframe.** It must be positioned relative to the selection's real
  on-screen rect, which only exists in the iframe's document. (A parent-drawn
  toolbar can't read the iframe selection geometry across origins.) The bridge owns
  it; the parent supplies theme tokens via `postMessage` so it matches chrome.
- **Contents (trimmed from the mockup — see §4):** `Bold` · `Italic` · `Link` ·
  `Color` (small, brand-limited swatch set). That's it for v1.
- **Visible:** only when a field is in contenteditable mode **and** there's a
  non-collapsed selection. Appears above the selection (`--dur-fast`, fade+rise 4px).
- **Recede:** hides on collapse, on blur, on Esc, on mode-off.
- **Refinement vs mockup:** the mockup's toolbar carries Turn-into (H1/H2/H3/Quote),
  Underline, Strikethrough, Code, and a "more" overflow. **Drop all of those for v1**
  (§4). A non-technical owner editing their own copy formats bold/italic/link/color
  and nothing else. Turning a headline into a paragraph by accident is a footgun.

### 2.6 In-canvas field affordance (hover + active outline)  *(iframe — bridge)*

- **Purpose:** show the owner *what is editable* and *what they're editing*, without
  a sidebar field list.
- **Form:** in Edit mode, hovering a `[data-cms-field]` editable element shows a
  soft outline (`1.5px` `--gold`, `outline-offset: 6–8px`) and a tiny plain-language
  label chip (the field's friendly name, e.g. "Headline" — **never** the raw
  `data-cms-field` id). Clicking promotes it to `contenteditable` with a solid
  `2px --gold` outline.
- **Visible:** Edit mode only.
- **Recede:** View mode → no outlines, no labels, no `cursor:text`; the site is inert.
- **Refinement vs mockup:** the mockup pulls the label from `data-label`. The real
  bridge only has `data-cms-field` (an id). **The build must add a friendly-name
  source** (a `data-cms-label` on the field, or a label map in the parent passed
  down). Surfacing the raw id violates "zero jargon." Flag this as a required bridge
  change.

### 2.7 Toast  *(parent)*

- **Purpose:** quiet confirmation — `Saved`, `Published {n} changes`, `Discarded`,
  `Nothing to publish yet`.
- **Form:** dark warm pill, centered, low; a `--gold` check for success. Auto-dismiss ~1.8s.
- **Visible:** on action only. **Recede:** fades out; never stacks, never demands a click.
- **Refinement:** success toasts use a `--live`/`--gold` check; the *only* place
  motion celebrates. No confetti.

### 2.8 Edit-mode hint  *(parent)*

- **Purpose:** teach the core gesture exactly once: `Click anything to edit · esc to finish`.
- **Form:** small mono pill near top-center on **first** entry into Edit mode.
- **Visible:** ~2.8s on first Edit-mode entry per session; suppressed thereafter
  (persist a flag).
- **Recede:** auto-fades; never reappears once dismissed/learned. **Refinement:** the
  mockup shows it every entry — show it once, then trust the user.

---

## 3. Interaction Model

### 3.1 The parent↔iframe split (what lives where)

| Concern | Parent window (React) | Iframe (site + `bridge.js`) |
|---|---|---|
| Mode toggle, theme | ✅ owns mode state | receives `cms:set-mode` (new) to toggle hover affordances |
| Bottom bar, History, Discard, Publish | ✅ | — |
| Left rail (Pages/Collections/Media) | ✅ | — |
| Right side panel (structured fields) | ✅ | — |
| Toast, hint | ✅ | — |
| **Inline text editing (contenteditable)** | — | ✅ the field becomes editable *in the iframe* |
| **Inline selection toolbar** | supplies theme tokens | ✅ bridge draws + positions it |
| Field discovery (id/value/rect/editable) | consumes | ✅ already does this |
| Field hover outline + friendly label chip | supplies label map | ✅ bridge renders |
| Persistence (drafts/published) | ✅ Convex mutations | — |

The line: **anything anchored to the page edges or to the app = parent. Anything
anchored to a specific spot in the site's content (an outline, the selection
toolbar, the caret) = iframe**, because only the iframe knows where that content
actually sits.

### 3.2 New messages this requires (extend `src/messages.ts`)

Today's contract supports parent→textarea editing. To move editing into the iframe,
add:

```ts
// parent → site
| { type: "cms:set-mode"; mode: "view" | "edit" }       // toggle iframe affordances
| { type: "cms:set-theme"; theme: "light" | "dark"; tokens: Record<string,string> } // style the in-iframe toolbar
| { type: "cms:enter-field"; fieldId: string }          // programmatic focus (rail/panel → field)
| { type: "cms:set-labels"; labels: Record<string,string> } // friendly names for chips

// site → parent
| { type: "cms:field-changed"; fieldId: string; value: string } // committed inline edit → stage draft
| { type: "cms:selection"; active: boolean }            // toolbar shown/hidden (optional, for parity)
```

`cms:field-clicked` stays (parent may still want to scroll the rail / sync
selection). The key addition is `cms:field-changed`: when the user finishes editing
a field **inside** the iframe, the bridge emits the new value and the parent stages
a draft — replacing today's "type in a parent textarea" flow.

### 3.3 A field's life: click → contenteditable → edit → draft

1. Owner is in **Edit** mode. Bridge has Edit affordances on (from `cms:set-mode`).
2. Hover a field → soft gold outline + friendly label chip (§2.6).
3. **Click** → bridge sets `contentEditable=true` on that element, focuses it, places
   caret. The outline goes solid gold. (Bridge currently `preventDefault`s the click
   and only reports it — extend it to enter edit mode.)
4. Owner types / selects text → the **selection toolbar** appears in-iframe for
   bold/italic/link/color (§2.5).
5. **Commit** (Esc, blur, or clicking another field): bridge sets
   `contentEditable=false`, reads `textContent` (or sanitized inline HTML if rich),
   and emits `cms:field-changed`.
6. Parent receives it → calls `saveDraft({fields:{[id]:value}})` (already exists) →
   `saveState: saving → saved`, increments the change-count, lights the draft dot.
   The value is now in `draftFields`, **not** `publishedFields` — the live site is untouched.

> Bridge implication: `applyField` currently overwrites `textContent`, which would
> nuke inline formatting. For rich inline edits the bridge must mutate
> `innerHTML`/sanitized markup, and `cms:field-changed` must carry the richer value.
> For a text-only v1, `textContent` is fine and the toolbar's link/color degrade to
> plain. Decide rich-vs-plain at build start; the doc assumes **light rich** (bold/
> italic/link/color) because the selection toolbar is in scope.

### 3.4 Change-count, Publish, Discard → the draft model (already in Convex)

The data model already separates `draftFields` from `publishedFields` (see
`convex/schema.ts` + `cms.ts`). Map the chrome straight onto it:

- **Change-count** = number of keys in `draftFields` (fields that differ from
  published). Surface as the Publish badge + "{n} unpublished" in status. *(Build
  note: today the count is a naive increment in the mockup; derive it from
  `draftFields` keys so it's truthful — discarding one field decrements it.)*
- **Publish** = `publishPage` → merges `draftFields` into `publishedFields`, clears
  drafts, stamps `publishedAt`. Count → 0, toast `Published {n} changes`, live site updates.
- **Discard** = clear `draftFields` and re-apply `publishedFields` into the iframe
  via `cms:apply-fields`. *(Build note: a `discardDrafts` mutation doesn't exist yet
  — add it: set `draftFields:{}`, return `publishedFields`.)* Always confirmed.
- **History** = list `publishedAt` snapshots; restore = stage a published snapshot as
  the new draft. (Schema today keeps only current published; History/versioning is a
  forward-looking addition — scope it explicitly or stub it.)

The preview the owner edits is **published ⊕ draft** (`getPreviewContent` already
merges this way). So the owner always sees their work-in-progress on the stage, and
Publish is the single, explicit, reversible-until-then act that changes reality.

### 3.5 Mode toggle behavior

- `Edit` → parent sets mode, sends `cms:set-mode:edit`; bottom bar + rail tab fade
  in; iframe enables hover outlines and click-to-edit; hint shows (first time only).
- `View` → parent sends `cms:set-mode:view`; commits any open inline edit first;
  closes rail + panel; chrome fades/slides out; iframe disables all affordances and
  becomes an inert preview of **published ⊕ draft** (so the owner previews their
  staged site exactly as Publish would make it).
- Drafts **persist across mode switches** — toggling to View is "preview my changes,"
  not "discard." Only Discard discards.

### 3.6 Keyboard

| Key | Context | Action |
|---|---|---|
| `Esc` | editing a field | commit + exit contenteditable (stay in Edit mode) |
| `Esc` | side panel open | close panel |
| `Esc` | rail open | close rail |
| `Esc` | selection toolbar open | hide toolbar (keep editing) |
| `Enter` | single-line field (headline, label) | commit + exit (prevent newline) |
| `Enter` | multi-line field (body/story) | newline (Shift not required) |
| `⌘/Ctrl+B` `⌘/Ctrl+I` | active selection | bold / italic |
| `⌘/Ctrl+K` | active selection | link |
| `⌘/Ctrl+Z` | editing | native undo within the field |

Esc is the universal "back out one level" key and the hint teaches it ("esc to
finish"). It must always leave the owner somewhere safe, never mid-broken-state.
Keyboard handlers for in-field keys live in the **iframe** (the bridge); global
chrome keys (close panel/rail) live in the **parent**. Both must coordinate Esc so
it bubbles predictably: field-level Esc is handled in the iframe and *not*
re-interpreted as "exit Edit mode."

---

## 4. What to Drop / Avoid

The mockup is a maximal demo of the *feel*; several pieces are Notion-developer
ergonomics that fight a non-technical owner editing their own live copy. Cut them:

| Element (in mockup) | Drop because |
|---|---|
| **Slash menu** (`/` command palette) | Power-user muscle memory; an owner doesn't know to type `/`, and it invites inserting blocks/structure they shouldn't author inline. Pure cognitive load. |
| **Turn-into (H1/H2/H3/Quote)** in the selection toolbar | Lets the owner silently re-tag a headline as body or a quote — breaks the site's design system and is invisible until something looks wrong. Structure is the developer's job; copy is the owner's. |
| **Code / inline `<code>` formatting** | No reason for prose on a marketing site; it's a developer affordance and the icon (`</>`) reads as jargon. |
| **Underline + Strikethrough** | Underline reads as a broken link on the web; strikethrough is an editing-process mark, not published copy. Keep bold/italic only. |
| **"More options" (⋯) overflow** in toolbar | A dense-toolbar tell. If the toolbar needs an overflow, it's already doing too much. |
| **Publish confetti animation** | Celebration motion contradicts "the tool disappears" and "restrained motion." Quiet toast instead. |
| **Gold-tinted ambient shadows** (`--shadow-gold`, CTA glow) | Spends the accent decoratively. Gold means "live/act" — keep it in fills and rings only. |
| **Raw `data-label` / field-id as the chip text** | The real bridge has only ids; never show `hero-headline` to the owner. Requires a friendly-name source (§2.6) — a build prerequisite, not an optional nicety. |
| **Pure `#fff` / `#0d0d0d` canvas** | Clinical at full-bleed; warmed neutrals (§1) read calmer and more premium. |
| **Multi-row / always-docked toolbars or a permanent sidebar field list** | The current `main.jsx` sidebar (field list + textarea) is the explicit anti-reference. Replace entirely with edit-in-place + on-intent chrome. |

Guiding test for any toolbar/menu item: *would the film-studio owner, changing the
words on their own homepage, ever need this — and could using it by accident break
their site?* If the answer is "no / yes," cut it.

---

## 5. Open Visual Proposals

Concrete refinements beyond the mockup, each serving calm + premium + non-technical-owner.

**P1 — Warm the whole system + quiet the gold (recommended, applied in §1).**
Swap pure white/black for warm off-white `#FBFAF8` / warm near-black `#1A1916`, warm
graphite dark mode, and warm-tinted low shadows. Restrict gold to three jobs only:
the live dot, the Publish fill, and the active selection outline. Introduce a
separate, calmer **`--draft`** amber-brown so "unpublished" reads as *staged/pending*
rather than competing with the "live/act" gold. *Why:* the mockup spends gold on
hero CTAs, glows, and labels; on a real canvas that's loud and dilutes the one
signal that must stay legible — what's live vs. what's a draft.

**P2 — Make "draft vs live" a visible material, not just a count.**
Beyond the number badge: (a) a draft-changed field gets a faint `--draft-tint` wash
+ a 2px `--draft` left-edge marker while in Edit mode, so the owner literally *sees
which words they changed*; (b) rail page-rows with staged changes show a small
`--draft` dot; (c) the status text always carries plain words: `{n} unpublished`.
*Why:* Principle 2 says a non-technical owner must *never wonder what's published*.
A lone badge is easy to miss; tinting the actual changed content makes draft state
spatial and obvious, and turns Discard from scary into "undo these highlighted bits."

**P3 — A real "site on a stage" frame (lean into the spatial model).**
Inset the iframe from the viewport with a small warm `--bg` margin (`--s-3`–`--s-5`)
and a soft `--shadow-xl`, so the customer's site reads as a *sheet resting on a
quiet stage* rather than filling the window edge-to-edge. The chrome (toggle, bottom
bar, rail tab) floats in that margin. In View mode the margin can collapse toward 0
so the site goes truly full-bleed (pure preview); in Edit mode it opens to give the
chrome a home and reinforce "this is the thing I'm working *on*." *Why:* it makes
the Framer/Webflow mental model physical, gives floating chrome a natural resting
band that never overlaps content, and the open/collapse of the margin becomes the
calm visual cue for entering/leaving Edit — restrained motion doing real work.

---

## 6. Build Prerequisites (carry into Phase D)

These are the gaps between the locked design and today's code — surface them at build start:

1. **Bridge: enter contenteditable on click** (today it only `preventDefault`s +
   reports the click). Add edit-in-place + commit → `cms:field-changed`.
2. **Bridge: draw the in-iframe selection toolbar** (bold/italic/link/color),
   themed by tokens pushed from the parent.
3. **Bridge: friendly-name source** for label chips (`data-cms-label` or a parent
   label map via `cms:set-labels`) — never show raw ids.
4. **Messages: extend `src/messages.ts`** with the new types in §3.2.
5. **Convex: add `discardDrafts` mutation** (clear `draftFields`, return published).
6. **Parent: replace `main.jsx` sidebar** (field list + textarea + overlay handles)
   with the §2 chrome — mode toggle, bottom bar, rail, side panel, toast, hint.
7. **Change-count: derive from `draftFields` keys**, not a naive increment, so it's truthful.
8. **Decide rich-vs-plain inline editing** up front (§3.3) — it determines whether
   the bridge mutates `textContent` or sanitized `innerHTML`.
9. **History/versioning** is forward-looking (schema keeps only current published) —
   scope or stub it explicitly.
```
