import React from "react";

function collectionCount(collection) {
  return Number.isFinite(collection.recordCount) ? collection.recordCount : 0;
}

export function CollectionsRailSection({ collections = [], draftCollectionKeys = [], onSelectCollection }) {
  const draftCollections = new Set(draftCollectionKeys);

  return (
    <div className="railGroup">
      <div className="railLabel">Collections</div>
      {collections.length ? (
        collections.map((collection) => (
          <button
            className="railRow"
            key={collection.key}
            onClick={() => onSelectCollection?.(collection.key)}
            type="button"
          >
            <span>{collection.label}</span>
            {draftCollections.has(collection.key) && <span className="draftDot" />}
            <span className="count">{collectionCount(collection)}</span>
          </button>
        ))
      ) : (
        <div className="railRow muted">No collections yet</div>
      )}
    </div>
  );
}
