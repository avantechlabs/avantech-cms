import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api.js";

type SaveState = "idle" | "saving" | "saved" | "publishing" | "published";

export function useFieldManager(projectSlug: string, pageSlug: string) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const seededSignatureRef = useRef("");
  // The latest in-flight draft save; publish/discard wait on it so a fast
  // commit-then-publish can never act on stale draft state.
  const pendingSaveRef = useRef<Promise<unknown>>(Promise.resolve());

  const seedDiscoveredFields = useMutation(api.cms.seedDiscoveredFields);
  const generateImageUploadUrl = useMutation(api.cms.generateImageUploadUrl);
  const saveDraft = useMutation(api.cms.saveDraft);
  const publishSite = useMutation(api.cms.publishSite);
  const discardSiteDrafts = useMutation(api.cms.discardSiteDrafts);

  function saveDraftField(fieldId: string, value: string) {
    setSaveState("saving");
    const saved = saveDraft({ projectSlug, pageSlug, fields: { [fieldId]: value } })
      .then(() => setSaveState("saved"));
    pendingSaveRef.current = saved.catch(() => {});
    return saved;
  }

  async function uploadImageDraft(fieldId: string, file: File) {
    setSaveState("saving");
    const uploaded = generateImageUploadUrl({ projectSlug, pageSlug, fieldId })
      .then(async (uploadUrl) => {
        if (!uploadUrl) throw new Error("Unable to create image upload URL.");

        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!response.ok) {
          throw new Error(`Image upload failed with status ${response.status}.`);
        }

        const { storageId } = await response.json();
        if (!storageId) throw new Error("Image upload did not return a storage ID.");

        const canonicalValue = `convex-storage:${storageId}`;
        await saveDraft({
          projectSlug,
          pageSlug,
          fields: { [fieldId]: canonicalValue },
        });
        setSaveState("saved");
        return canonicalValue;
      })
      .catch((error) => {
        setSaveState("idle");
        throw error;
      });

    pendingSaveRef.current = uploaded.catch(() => {});
    return uploaded;
  }

  function publish() {
    setSaveState("publishing");
    return pendingSaveRef.current
      .then(() => publishSite({ projectSlug, pageSlug }))
      .then(() => setSaveState("published"));
  }

  function discard() {
    return pendingSaveRef.current.then(() =>
      discardSiteDrafts({ projectSlug, pageSlug }),
    );
  }

  function resetForProject() {
    seededSignatureRef.current = "";
  }

  return {
    saveState,
    seededSignatureRef,
    seedDiscoveredFields,
    saveDraftField,
    uploadImageDraft,
    publish,
    discard,
    resetForProject,
  };
}
