import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api.js";
import type { FieldData } from "../messages.js";

const PAGE_SLUG = "home";

export function useFieldManager(projectSlug: string) {
  const [fields, setFields] = useState<FieldData[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "publishing" | "published">("idle");
  const seededSignatureRef = useRef("");

  const seedDiscoveredFields = useMutation(api.cms.seedDiscoveredFields);
  const saveDraft = useMutation(api.cms.saveDraft);
  const publishPage = useMutation(api.cms.publishPage);

  function saveDraftField(fieldId: string, value: string) {
    setSaveState("saving");
    setFieldValues((current) => ({ ...current, [fieldId]: value }));
    saveDraft({ projectSlug, pageSlug: PAGE_SLUG, fields: { [fieldId]: value } })
      .then(() => setSaveState("saved"));
  }

  function publish() {
    setSaveState("publishing");
    publishPage({ projectSlug, pageSlug: PAGE_SLUG })
      .then(() => setSaveState("published"));
  }

  function resetForProject() {
    seededSignatureRef.current = "";
    setFields([]);
    setSelectedId(null);
  }

  return {
    fields,
    setFields,
    fieldValues,
    setFieldValues,
    selectedId,
    setSelectedId,
    saveState,
    seededSignatureRef,
    seedDiscoveredFields,
    saveDraftField,
    publish,
    resetForProject,
  };
}
