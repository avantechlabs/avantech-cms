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
  const options = Array.isArray(field.options) ? field.options : [];

  function optionValue(option) {
    return typeof option === "object" && option !== null ? option.value : option;
  }

  function optionLabel(option) {
    return typeof option === "object" && option !== null ? option.label ?? option.value : option;
  }

  if (type === "textarea" || type === "longText") {
    return (
      <label className="recordField" htmlFor={id}>
        <span>{label}</span>
        <textarea id={id} value={stringValue} onChange={(event) => onChange(field, event.target.value)} />
      </label>
    );
  }

  if (type === "number") {
    return (
      <label className="recordField" htmlFor={id}>
        <span>{label}</span>
        <input
          id={id}
          type="number"
          value={stringValue}
          onChange={(event) =>
            onChange(field, event.target.value === "" ? null : Number(event.target.value))
          }
        />
      </label>
    );
  }

  if (type === "boolean") {
    return (
      <label className="recordField recordFieldCheckbox" htmlFor={id}>
        <input
          checked={Boolean(value)}
          id={id}
          type="checkbox"
          onChange={(event) => onChange(field, event.target.checked)}
        />
        <span>{label}</span>
      </label>
    );
  }

  if (type === "select" || type === "multiSelect") {
    const selectedValues = Array.isArray(value) ? value.map(String) : [stringValue];
    return (
      <label className="recordField" htmlFor={id}>
        <span>{label}</span>
        <select
          id={id}
          multiple={type === "multiSelect"}
          value={type === "multiSelect" ? selectedValues : stringValue}
          onChange={(event) => {
            if (type === "multiSelect") {
              onChange(
                field,
                [...event.target.selectedOptions].map((option) => option.value),
              );
            } else {
              onChange(field, event.target.value);
            }
          }}
        >
          {type === "select" && <option value="">Choose...</option>}
          {options.map((option) => {
            const nextValue = optionValue(option);
            return (
              <option key={String(nextValue)} value={String(nextValue)}>
                {optionLabel(option)}
              </option>
            );
          })}
        </select>
      </label>
    );
  }

  if (["url", "email", "date", "datetime", "color"].includes(type)) {
    const inputType = type === "datetime" ? "datetime-local" : type;
    return (
      <label className="recordField" htmlFor={id}>
        <span>{label}</span>
        <input
          id={id}
          type={inputType}
          value={stringValue}
          onChange={(event) => onChange(field, event.target.value)}
        />
      </label>
    );
  }

  if (type !== "text") {
    return (
      <div className="recordFieldUnsupported" role="alert">
        Unsupported field type: {type}
      </div>
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
