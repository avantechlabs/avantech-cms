import type { RefObject } from "react";
import styles from "./PreviewFrame.module.css";

type PreviewFrameProps = {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  projectName: string;
  siteUrl: string | null | undefined;
  previewError?: string | null;
};

export function PreviewFrame({ iframeRef, projectName, siteUrl, previewError }: PreviewFrameProps) {
  return (
    <div className={styles.frame}>
      {siteUrl ? (
        <iframe ref={iframeRef} src={siteUrl} title={`${projectName} preview`} />
      ) : (
        <div className={styles.loading} role={previewError ? "alert" : "status"}>
          {previewError ?? "Loading preview..."}
        </div>
      )}
    </div>
  );
}
