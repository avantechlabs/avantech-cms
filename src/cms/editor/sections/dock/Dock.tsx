import styles from "./Dock.module.css";

type DockProps = {
  language: string;
  mode: "edit" | "view";
  onLanguageChange: (language: string) => void;
  onModeChange: (mode: "edit" | "view") => void;
  onSignOut: () => void;
  onThemeToggle: () => void;
  theme: "dark" | "light";
};

export function Dock({
  language,
  mode,
  onLanguageChange,
  onModeChange,
  onSignOut,
  onThemeToggle,
  theme,
}: DockProps) {
  return (
    <div className={styles.dock}>
      <button
        className={styles.iconBtn}
        onClick={onThemeToggle}
        title="Toggle theme"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>
      <div className={styles.modeToggle} role="group" aria-label="Mode">
        <button className={mode === "view" ? styles.on : ""} onClick={() => onModeChange("view")}>View</button>
        <button className={mode === "edit" ? styles.on : ""} onClick={() => onModeChange("edit")}>Edit</button>
      </div>
      <div className={styles.modeToggle} role="group" aria-label="Language">
        <button
          className={language === "fr" ? styles.on : ""}
          onClick={() => onLanguageChange("fr")}
        >
          FR
        </button>
        <button
          className={language === "en" ? styles.on : ""}
          onClick={() => onLanguageChange("en")}
        >
          EN
        </button>
      </div>
      <button
        className={styles.iconBtn}
        onClick={onSignOut}
        title="Sign out"
        aria-label="Sign out"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      </button>
    </div>
  );
}
