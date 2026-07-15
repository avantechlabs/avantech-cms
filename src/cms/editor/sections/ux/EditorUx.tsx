import styles from "./EditorUx.module.css";

type EditorUxProps = {
  hint: boolean;
  toast: string;
};

export function EditorUx({ hint, toast }: EditorUxProps) {
  return (
    <>
      <div className={`${styles.toast}${toast ? ` ${styles.show}` : ""}`} role="status">
        <span className={styles.check}>✓</span>
        <span>{toast}</span>
      </div>
      <div className={`${styles.hint}${hint ? ` ${styles.show}` : ""}`}>
        Click any text to edit · <span className={styles.key}>esc</span> to finish
      </div>
    </>
  );
}
