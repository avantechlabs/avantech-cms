const FIELD_SYNONYMS = {
  desc: "description",
  cta: "button",
  subtitle: "subtitle",
  lede: "intro",
  eyebrow: "label",
  copy: "text",
  nav: "nav",
  brand: "brand",
  hero: "hero",
  stats: "stat",
  features: "feature",
  steps: "step",
  testimonial: "quote",
};

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Owners never see raw field ids. Build a plain, sentence-cased phrase and keep
// the descriptive noun ("hero.image" -> "Hero image") so the label reads as a
// thing an owner recognizes, not a codeword or a raw id.
export function imageFieldTitle(fieldId: string) {
  const phrase = fieldId
    .split(".")
    .map((seg) => {
      if (/^\d+$/.test(seg)) return String(Number(seg) + 1);
      if (FIELD_SYNONYMS[seg as keyof typeof FIELD_SYNONYMS]) {
        return FIELD_SYNONYMS[seg as keyof typeof FIELD_SYNONYMS];
      }
      return seg.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
    })
    .join(" ")
    .toLowerCase();
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}
