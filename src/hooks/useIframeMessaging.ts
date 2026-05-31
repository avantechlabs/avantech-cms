import { useCallback, useEffect, useRef } from "react";
import type { CmsToSiteMessage, FieldData, SiteToCmsMessage } from "../messages.js";

interface UseIframeMessagingOptions {
  previewOrigin: string;
  projectSlug: string;
  onReady: () => void;
  onFields: (fields: FieldData[]) => void;
  onFieldClicked: (fieldId: string) => void;
}

export function useIframeMessaging({
  previewOrigin,
  projectSlug,
  onReady,
  onFields,
  onFieldClicked,
}: UseIframeMessagingOptions) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const send = useCallback(
    (message: CmsToSiteMessage) => {
      if (!previewOrigin) return;
      iframeRef.current?.contentWindow?.postMessage(message, previewOrigin);
    },
    [previewOrigin],
  );

  useEffect(() => {
    if (!previewOrigin) return;

    function onMessage(event: MessageEvent) {
      if (event.origin !== previewOrigin) return;
      const message = event.data as SiteToCmsMessage;

      if (message.type === "cms:ready") onReady();
      if (message.type === "cms:fields") onFields(message.fields);
      if (message.type === "cms:field-clicked") onFieldClicked(message.fieldId);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewOrigin, projectSlug]);

  return { iframeRef, send };
}
