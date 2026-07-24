import styles from "./Dock.module.css";

type DockProps = {
  language: string;
  mode: "edit" | "view";
  onLanguageChange: (language: string) => void;
  onModeChange: (mode: "edit" | "view") => void;
  onThemeToggle: () => void;
  theme: "dark" | "light";
};

export function Dock({
  language,
  mode,
  onLanguageChange,
  onModeChange,
  onThemeToggle,
  theme,
}: DockProps) {
  return (
    <div className={styles.dock}>
      <div className={styles.modeToggle} role="group" aria-label="Mode">
        <button className={mode === "view" ? styles.on : ""} onClick={() => onModeChange("view")}>View</button>
        <button className={mode === "edit" ? styles.on : ""} onClick={() => onModeChange("edit")}>Edit</button>
      </div>
      <div className={styles.prefs}>
        <button
          className={styles.iconBtn}
          onClick={onThemeToggle}
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
        <div className={styles.langToggle} role="group" aria-label="Language">
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
      </div>
    </div>
  );
}
