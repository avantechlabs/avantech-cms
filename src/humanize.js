// Plain-language helpers so the editor never shows raw ids, slugs, or field
// paths to a site owner. (.impeccable.md: zero jargon, no internal names.)

export function getAtPath(source, path) {
  if (!path) return undefined;
  return String(path)
    .split(".")
    .filter(Boolean)
    .reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), source);
}

function sentenceCase(words) {
  const phrase = words.filter(Boolean).join(" ").toLowerCase();
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

// "brand-refresh" / "brand_refresh" -> "Brand refresh"
export function humanizeSlug(slug) {
  if (!slug) return "";
  return sentenceCase(String(slug).split(/[-_\s]+/));
}

// "seo.metaTitle" -> "Meta title" (last segment, camelCase split)
export function humanizeFieldLabel(path) {
  const segments = String(path).split(".").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  const spaced = last.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return sentenceCase(spaced.split(/[-_\s]+/));
}

// "Brand Refresh!" -> "brand-refresh". May return "" — callers supply a fallback.
export function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Human title for a record: the collection's titlePath value when it's a
// non-empty string, otherwise a humanized slug. Never the raw slug.
export function recordTitle(collection, slug, data) {
  const fromPath = collection?.titlePath ? getAtPath(data, collection.titlePath) : undefined;
  if (typeof fromPath === "string" && fromPath.trim()) return fromPath.trim();
  return humanizeSlug(slug);
}
