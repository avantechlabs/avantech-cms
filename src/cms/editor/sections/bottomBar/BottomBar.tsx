import { useEffect, useState } from "react";
import styles from "./BottomBar.module.css";

type BottomBarProps = {
  changeCount: number;
  onDiscard: () => void;
  onPublish: () => void;
  pageName: string;
  projectName: string;
};

export function BottomBar({
  changeCount,
  onDiscard,
  onPublish,
  pageName,
  projectName,
}: BottomBarProps) {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // Leave the confirm state on Escape, or when the drafts it referred to are gone.
  useEffect(() => {
    if (!confirmingDiscard) return undefined;
    if (changeCount === 0) {
      setConfirmingDiscard(false);
      return undefined;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirmingDiscard(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmingDiscard, changeCount]);

  if (confirmingDiscard) {
    return (
      <div
        className={`${styles.bottomBar} ${styles.confirming}`}
        role="toolbar"
        aria-label="Confirm discard"
      >
        <div className={styles.status} role="alert">
          <span>
            Discard {changeCount} unpublished change{changeCount > 1 ? "s" : ""}? Your live
            site won’t change.
          </span>
        </div>
        <span className={styles.sep} />
        <button
          className={styles.barBtn}
          onClick={() => setConfirmingDiscard(false)}
          autoFocus
        >
          Keep editing
        </button>
        <button
          className={`${styles.barBtn} ${styles.dangerBtn}`}
          onClick={() => {
            setConfirmingDiscard(false);
            onDiscard();
          }}
        >
          Discard
        </button>
      </div>
    );
  }

  return (
    <div className={styles.bottomBar} role="toolbar" aria-label="Editor actions">
      <div className={styles.status}>
        <span className={styles.dot} />
        <span>Editing {projectName} / {pageName}</span>
        {changeCount > 0 && (
          <span className={styles.unpublished}>· {changeCount} unpublished</span>
        )}
      </div>
      <span className={styles.sep} />
      <button
        className={styles.barBtn}
        onClick={() => setConfirmingDiscard(true)}
        disabled={changeCount === 0}
      >
        Discard
      </button>
      <button
        className={`${styles.barBtn} ${styles.primary}`}
        onClick={onPublish}
        disabled={changeCount === 0}
      >
        {changeCount > 0 && <span className={styles.badge}>{changeCount}</span>}
        Publish
      </button>
    </div>
  );
}
