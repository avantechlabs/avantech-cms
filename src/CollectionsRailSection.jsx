import React from "react";

function collectionCount(collection) {
  return Number.isFinite(collection.recordCount) ? collection.recordCount : 0;
}

export function CollectionsRailSection({ collections = [] }) {
  return (
    <div className="railGroup">
      <div className="railLabel">Collections</div>
      {collections.length ? (
        collections.map((collection) => (
          <div className="railRow" key={collection.key}>
            <span>{collection.label}</span>
            <span className="count">{collectionCount(collection)}</span>
          </div>
        ))
      ) : (
        <div className="railRow muted">No collections yet</div>
      )}
    </div>
  );
}
