import type { ChangeEvent, DragEvent, RefObject } from "react";
import styles from "./ImagePanel.module.css";

type ImagePanelProps = {
  cardRef: RefObject<HTMLElement | null>;
  imageError: string | null;
  imageIsDraft: boolean;
  imagePreviewSrc: string | null;
  imageTitle: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  isUploading: boolean;
  onChooseImage: () => void;
  onClose: () => void;
  onDragLeave: (event: DragEvent<HTMLButtonElement>) => void;
  onDragOver: (event: DragEvent<HTMLButtonElement>) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function ImagePanel({
  cardRef,
  imageError,
  imageIsDraft,
  imagePreviewSrc,
  imageTitle,
  inputRef,
  isDragging,
  isUploading,
  onChooseImage,
  onClose,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileChange,
}: ImagePanelProps) {
  return (
    <aside
      ref={cardRef}
      className={`${styles.imageCard}${isDragging ? ` ${styles.dragging}` : ""}`}
      aria-label={`Edit ${imageTitle} image`}
    >
      <div className={styles.imageCardHead}>
        <div className={styles.imageCardMeta}>
          <span className={styles.imageCardEyebrow}>Image</span>
          <span className={styles.imageCardTitle}>{imageTitle}</span>
        </div>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close" type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <button
        type="button"
        className={`${styles.imageDrop}${isDragging ? ` ${styles.drag}` : ""}${isUploading ? ` ${styles.uploading}` : ""}`}
        onClick={onChooseImage}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        aria-label="Replace image — click to choose a file, or drop one here"
      >
        {imagePreviewSrc ? (
          <img src={imagePreviewSrc} alt="" />
        ) : (
          <span className={styles.imageDropEmpty}>No image yet</span>
        )}
        <span className={styles.imageDropHint}>
          {isUploading ? (
            <><span className={styles.spinner} aria-hidden="true" />Uploading…</>
          ) : (
            "Drop an image, or click to replace"
          )}
        </span>
      </button>

      {imageError ? (
        <p className={styles.imageError} role="alert">{imageError}</p>
      ) : (
        <p className={`${styles.imageStatus}${imageIsDraft ? ` ${styles.draft}` : ""}`} aria-live="polite">
          <span className={styles.dot} />
          {isUploading
            ? "Saving…"
            : imageIsDraft
              ? "Draft — not published yet"
              : "Published — live on your site"}
        </p>
      )}

      <div className={styles.imageCardActions}>
        <button className={styles.replaceButton} onClick={onChooseImage} disabled={isUploading} type="button">
          {isUploading ? "Uploading…" : "Replace image"}
        </button>
      </div>

      <input
        ref={inputRef}
        className={styles.fileInput}
        type="file"
        accept="image/*"
        onChange={onFileChange}
      />
    </aside>
  );
}
