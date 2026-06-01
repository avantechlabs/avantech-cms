import React from "react";

function fieldGroups(collection) {
  if (Array.isArray(collection?.groups) && collection.groups.length) {
    return collection.groups.map((group) => ({
      label: group.label,
      fields: Array.isArray(group.fields) ? group.fields : [],
    }));
  }
  return [{ label: null, fields: Array.isArray(collection?.fields) ? collection.fields : [] }];
}

function getAtPath(source, path) {
  return path
    .split(".")
    .filter(Boolean)
    .reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), source);
}

function FieldControl({ field, value, onChange }) {
  const id = `record-field-${field.path}`;
  const label = field.label ?? field.path;
  const type = field.type ?? "text";
  const stringValue = value == null ? "" : String(value);

  if (type === "textarea" || type === "longText") {
    return (
      <label className="recordField" htmlFor={id}>
        <span>{label}</span>
        <textarea id={id} value={stringValue} onChange={(event) => onChange(field, event.target.value)} />
      </label>
    );
  }

  return (
    <label className="recordField" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="text" value={stringValue} onChange={(event) => onChange(field, event.target.value)} />
    </label>
  );
}

export function RecordPanel({ collection, record, recordData, onFieldChange, onClose, children }) {
  if (!record) return null;

  const groups = fieldGroups(collection);
  const hasFields = groups.some((group) => group.fields.length > 0);

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
          {hasFields ? (
            groups.map((group, index) => (
              <section className="recordFieldGroup" key={group.label ?? index}>
                {group.label && <h3>{group.label}</h3>}
                {group.fields.map((field) => (
                  <FieldControl
                    field={field}
                    key={field.path}
                    value={getAtPath(recordData, field.path)}
                    onChange={(changedField, value) => onFieldChange?.(changedField.path, value)}
                  />
                ))}
              </section>
            ))
          ) : (
            <p className="recordPanelEmpty">No editable fields yet.</p>
          )}
        </div>
      )}
      <div className="recordPanelActions">
        <button className="barBtn primary" onClick={onClose}>Done</button>
      </div>
    </aside>
  );
}
