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

function setAtPath(source, path, value) {
  const keys = path.split(".").filter(Boolean);
  const root = source && typeof source === "object" && !Array.isArray(source) ? { ...source } : {};
  let cursor = root;
  for (const key of keys.slice(0, -1)) {
    const next = cursor[key];
    cursor[key] = next && typeof next === "object" && !Array.isArray(next) ? { ...next } : {};
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
  return root;
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

  if (type === "object" || type === "group") {
    const fields = Array.isArray(field.fields) ? field.fields : [];
    return (
      <fieldset className="recordNestedGroup">
        <legend>{label}</legend>
        {fields.map((child) => (
          <FieldControl
            field={{ ...child, path: `${field.path}.${child.path}` }}
            key={child.path}
            value={getAtPath(value, child.path)}
            onChange={onChange}
          />
        ))}
      </fieldset>
    );
  }

  if (type === "list") {
    const itemFields = Array.isArray(field.itemFields) ? field.itemFields : [];
    const items = Array.isArray(value) ? value : [];
    const defaultItem = field.defaultItem ?? {};

    function updateItems(nextItems) {
      onChange(field, nextItems);
    }

    return (
      <div className="recordListField">
        <div className="recordListHead">
          <span>{label}</span>
          <button type="button" className="barBtn" onClick={() => updateItems([...items, defaultItem])}>
            Add
          </button>
        </div>
        {items.map((item, index) => (
          <div className="recordListItem" key={item.id ?? index}>
            <div className="recordListItemHead">
              <span>Item {index + 1}</span>
              <div className="recordListActions">
                <button
                  type="button"
                  className="barBtn"
                  disabled={index === 0}
                  onClick={() => {
                    const next = [...items];
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    updateItems(next);
                  }}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="barBtn"
                  disabled={index === items.length - 1}
                  onClick={() => {
                    const next = [...items];
                    [next[index + 1], next[index]] = [next[index], next[index + 1]];
                    updateItems(next);
                  }}
                >
                  Down
                </button>
                <button
                  type="button"
                  className="barBtn"
                  onClick={() => updateItems(items.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove
                </button>
              </div>
            </div>
            {itemFields.map((itemField) => (
              <FieldControl
                field={itemField}
                key={itemField.path}
                value={getAtPath(item, itemField.path)}
                onChange={(changedField, nextValue) => {
                  const next = [...items];
                  next[index] = setAtPath(next[index], changedField.path, nextValue);
                  updateItems(next);
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (type === "image" || type === "file") {
    return (
      <div className="recordField">
        <span>{label}</span>
        {type === "image" && stringValue ? <img className="recordMediaPreview" src={stringValue} alt="" /> : null}
        {type === "file" && stringValue ? <span className="recordFileValue">{stringValue}</span> : null}
        <input
          type="file"
          accept={type === "image" ? "image/*" : undefined}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onChange(field, file);
            event.target.value = "";
          }}
        />
      </div>
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
