import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api.js";

const PAGE_SLUG = "home";

type SaveState = "idle" | "saving" | "saved" | "publishing" | "published";

export function useFieldManager(projectSlug: string) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const seededSignatureRef = useRef("");

  const seedDiscoveredFields = useMutation(api.cms.seedDiscoveredFields);
  const saveDraft = useMutation(api.cms.saveDraft);
  const publishPage = useMutation(api.cms.publishPage);
  const discardDrafts = useMutation(api.cms.discardDrafts);

  function saveDraftField(fieldId: string, value: string) {
    setSaveState("saving");
    return saveDraft({ projectSlug, pageSlug: PAGE_SLUG, fields: { [fieldId]: value } })
      .then(() => setSaveState("saved"));
  }

  function publish() {
    setSaveState("publishing");
    return publishPage({ projectSlug, pageSlug: PAGE_SLUG })
      .then(() => setSaveState("published"));
  }

  function discard() {
    return discardDrafts({ projectSlug, pageSlug: PAGE_SLUG });
  }

  function resetForProject() {
    seededSignatureRef.current = "";
  }

  return {
    saveState,
    seededSignatureRef,
    seedDiscoveredFields,
    saveDraftField,
    publish,
    discard,
    resetForProject,
  };
}
