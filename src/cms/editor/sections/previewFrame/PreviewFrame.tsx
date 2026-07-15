import type { RefObject } from "react";
import styles from "./PreviewFrame.module.css";

type PreviewFrameProps = {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  projectName: string;
  siteUrl: string | null | undefined;
};

export function PreviewFrame({ iframeRef, projectName, siteUrl }: PreviewFrameProps) {
  return (
    <div className={styles.frame}>
      {siteUrl ? (
        <iframe ref={iframeRef} src={siteUrl} title={`${projectName} preview`} />
      ) : (
        <div className={styles.loading}>Loading preview…</div>
      )}
    </div>
  );
}
