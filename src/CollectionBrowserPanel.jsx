import React, { useState } from "react";

export function CollectionBrowserPanel({
  collection,
  records = [],
  draftSlugs = [],
  onCreate,
  onSelectRecord,
  onClose,
}) {
  const [slug, setSlug] = useState("");
  const draftSlugSet = new Set(draftSlugs);
  if (!collection) return null;

  function submit(event) {
    event.preventDefault();
    const nextSlug = slug.trim();
    if (!nextSlug) return;
    onCreate(nextSlug);
    setSlug("");
  }

  return (
    <aside className="recordPanel" aria-label={`${collection.label} records`}>
      <div className="recordPanelHead">
        <div className="recordPanelMeta">
          <span className="recordPanelEyebrow">Collection</span>
          <span className="recordPanelTitle">{collection.label}</span>
        </div>
        <button className="railClose" onClick={onClose} aria-label="Close collection browser">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="recordPanelBody">
        <div className="collectionRecordList">
          {records.length ? (
            records.map((record) => (
              <button
                className="collectionRecordRow"
                key={record.slug}
                onClick={() => onSelectRecord(record.slug)}
                type="button"
              >
                <span>{record.slug}</span>
                {draftSlugSet.has(record.slug) && <span className="draftDot" />}
              </button>
            ))
          ) : (
            <p className="recordPanelEmpty">No records yet.</p>
          )}
        </div>
      </div>

      <form className="createRecordForm" onSubmit={submit}>
        <label className="recordField">
          <span>New record slug</span>
          <input value={slug} onChange={(event) => setSlug(event.target.value)} />
        </label>
        <button className="barBtn primary" type="submit">Create</button>
      </form>
    </aside>
  );
}
