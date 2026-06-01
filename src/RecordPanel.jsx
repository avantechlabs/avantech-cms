import React from "react";

export function RecordPanel({ collection, record, onClose, children }) {
  if (!record) return null;

  return (
    <aside className="recordPanel" aria-label={`Edit ${record.itemSlug}`}>
      <div className="recordPanelHead">
        <div className="recordPanelMeta">
          <span className="recordPanelEyebrow">{collection?.label ?? record.collectionKey}</span>
          <span className="recordPanelTitle">{record.itemSlug}</span>
        </div>
        <button className="railClose" onClick={onClose} aria-label="Close record panel">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      {children ?? (
        <div className="recordPanelBody">
          <p className="recordPanelEmpty">Record editor coming next.</p>
        </div>
      )}
      <div className="recordPanelActions">
        <button className="barBtn primary" onClick={onClose}>Done</button>
      </div>
    </aside>
  );
}
