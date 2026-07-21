import type { ChangeEvent, DragEvent, RefObject } from "react";
import styles from "./ImagePanel.module.css";

type ImagePanelProps = {
  cardRef: RefObject<HTMLElement | null>;
  imageTitle: string;
  inputRef: RefObject<HTMLInputElement | null>;
  slots: ImageSlot[];
  onChooseImage: (slotId: string) => void;
  onClose: () => void;
  onDragLeave: (slotId: string, event: DragEvent<HTMLButtonElement>) => void;
  onDragOver: (slotId: string, event: DragEvent<HTMLButtonElement>) => void;
  onDrop: (slotId: string, event: DragEvent<HTMLButtonElement>) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

type ImageSlot = {
  id: string;
  title: string;
  error: string | null;
  isDraft: boolean;
  isDragging: boolean;
  isUploading: boolean;
  previewSrc: string | null;
};

export function ImagePanel({
  cardRef,
  imageTitle,
  inputRef,
  onChooseImage,
  onClose,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileChange,
  slots,
}: ImagePanelProps) {
  return (
    <aside
      ref={cardRef}
      className={styles.imageCard}
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

      <div className={styles.imageSlots}>
        {slots.map((slot) => (
          <section className={styles.imageSlot} key={slot.id} aria-label={`${slot.title} image slot`}>
            <div className={styles.imageSlotHead}>
              <span className={styles.imageSlotTitle}>{slot.title}</span>
              {slot.error ? null : (
                <span
                  className={`${styles.imageSlotStatus}${slot.isDraft ? ` ${styles.draft}` : ""}`}
                  aria-live="polite"
                >
                  <span className={styles.dot} />
                  {slot.isUploading
                    ? "Saving…"
                    : slot.isDraft
                      ? "Draft — not published yet"
                      : "Published — live on your site"}
                </span>
              )}
            </div>

            <button
              type="button"
              className={`${styles.imageDrop}${slot.isDragging ? ` ${styles.drag}` : ""}${slot.isUploading ? ` ${styles.uploading}` : ""}`}
              onClick={() => onChooseImage(slot.id)}
              onDragOver={(event) => onDragOver(slot.id, event)}
              onDragLeave={(event) => onDragLeave(slot.id, event)}
              onDrop={(event) => onDrop(slot.id, event)}
              aria-label={`Replace ${slot.title} image`}
            >
              {slot.previewSrc ? (
                <img src={slot.previewSrc} alt="" />
              ) : (
                <span className={styles.imageDropEmpty}>No image yet</span>
              )}
              <span className={styles.imageDropHint}>
                {slot.isUploading ? (
                  <><span className={styles.spinner} aria-hidden="true" />Uploading…</>
                ) : (
                  "Drop an image, or click to replace"
                )}
              </span>
            </button>

            {slot.error ? (
              <p className={styles.imageError} role="alert">{slot.error}</p>
            ) : null}

            <div className={styles.imageCardActions}>
              <button
                className={styles.replaceButton}
                onClick={() => onChooseImage(slot.id)}
                disabled={slot.isUploading}
                type="button"
                aria-label={`Replace ${slot.title} image`}
              >
                {slot.isUploading ? "Uploading…" : "Replace image"}
              </button>
            </div>
          </section>
        ))}
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
