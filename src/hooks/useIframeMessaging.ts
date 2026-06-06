import { useCallback, useEffect, useRef } from "react";
import type {
  CmsToSiteMessage,
  CollectionDefinition,
  FieldData,
  PageDefinition,
  RecordRegionData,
  SiteToCmsMessage,
} from "../messages.js";

interface UseIframeMessagingOptions {
  previewOrigin: string;
  projectSlug: string;
  pageSlug: string;
  frameKey?: string;
  onReady: () => void;
  onFields: (fields: FieldData[]) => void;
  onCollections?: (collections: CollectionDefinition[]) => void;
  onPages?: (pages: PageDefinition[]) => void;
  onRecords?: (records: RecordRegionData[]) => void;
  onFieldClicked: (fieldId: string, kind: FieldData["kind"]) => void;
  onRecordClicked?: (collectionKey: string, itemSlug: string) => void;
  onFieldChanged: (fieldId: string, value: string) => void;
  onEditing: (fieldId: string | null) => void;
}

export function useIframeMessaging(options: UseIframeMessagingOptions) {
  const { previewOrigin, projectSlug, pageSlug, frameKey } = options;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Always call the latest callbacks without re-subscribing the listener.
  const handlers = useRef(options);
  handlers.current = options;

  // Queue messages until the bridge announces it's ready, so we never post to a
  // not-yet-loaded iframe (avoids origin-mismatch warnings + dropped content).
  const readyRef = useRef(false);
  const queueRef = useRef<CmsToSiteMessage[]>([]);

  const send = useCallback(
    (message: CmsToSiteMessage) => {
      if (!previewOrigin) return;
      if (!readyRef.current) {
        queueRef.current.push(message);
        return;
      }
      iframeRef.current?.contentWindow?.postMessage(message, previewOrigin);
    },
    [previewOrigin],
  );

  useEffect(() => {
    if (!previewOrigin) return;

    // A fresh iframe (new project / reload) starts not-ready.
    readyRef.current = false;
    queueRef.current = [];

    function onMessage(event: MessageEvent) {
      if (event.origin !== previewOrigin) return;
      const message = event.data as SiteToCmsMessage;
      const h = handlers.current;

      if (message.type === "cms:ready") {
        readyRef.current = true;
        const pending = queueRef.current;
        queueRef.current = [];
        for (const queued of pending) {
          iframeRef.current?.contentWindow?.postMessage(queued, previewOrigin);
        }
        h.onReady();
      } else if (message.type === "cms:fields") h.onFields(message.fields);
      else if (message.type === "cms:pages") h.onPages?.(message.pages);
      else if (message.type === "cms:collections") h.onCollections?.(message.collections);
      else if (message.type === "cms:records") h.onRecords?.(message.records);
      else if (message.type === "cms:field-clicked") h.onFieldClicked(message.fieldId, message.kind);
      else if (message.type === "cms:record-clicked")
        h.onRecordClicked?.(message.collectionKey, message.itemSlug);
      else if (message.type === "cms:field-changed") h.onFieldChanged(message.fieldId, message.value);
      else if (message.type === "cms:editing") h.onEditing(message.fieldId);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewOrigin, projectSlug, pageSlug, frameKey]);

  return { iframeRef, send };
}
