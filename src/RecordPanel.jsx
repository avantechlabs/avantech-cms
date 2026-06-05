import React, { useEffect, useRef, useState } from "react";
import { getAtPath, humanizeFieldLabel, recordTitle } from "./humanize.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function fileBasename(value) {
  const clean = String(value).split(/[?#]/)[0];
  const last = clean.split("/").pop();
  return last || String(value);
}

// A media field that matches the page image picker: a dropzone (click +
// drag-drop), optimistic preview, inline validation, and upload progress.
// Upload is awaitable via onUpload(path, file); scalar saves go elsewhere.
function MediaField({ field, value, onUpload, uploadable = true }) {
  const isImage = (field.type ?? "text") === "image";
  const label = field.label ?? humanizeFieldLabel(field.path);
  const stringValue = value == null ? "" : String(value);

  const [isUploading, setUploading] = useState(false);
  const [isDragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const pendingUrlRef = useRef(null);
  const seqRef = useRef(0);
  const awaitingValueRef = useRef(false);

  function revoke() {
    if (pendingUrlRef.current) {
      URL.revokeObjectURL(pendingUrlRef.current);
      pendingUrlRef.current = null;
    }
  }
  useEffect(() => () => revoke(), []);

  // Once the saved (non-blob) value lands after a successful upload, drop the
  // optimistic object URL and show the resolved one.
  useEffect(() => {
    if (!awaitingValueRef.current) return;
    if (stringValue && !stringValue.startsWith("blob:")) {
      awaitingValueRef.current = false;
      revoke();
      setPendingPreview(null);
    }
  }, [stringValue]);

  function handleFile(file) {
    if (!file || isUploading || !onUpload) return;
    setError(null);
    if (isImage && !file.type.startsWith("image/")) {
      setError("That file isn’t an image.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is over 10 MB — try a smaller one.");
      return;
    }

    const seq = ++seqRef.current;
    if (isImage) {
      revoke();
      const url = URL.createObjectURL(file);
      pendingUrlRef.current = url;
      setPendingPreview(url);
    }
    setUploading(true);
    Promise.resolve(onUpload(field.path, file))
      .then(() => {
        if (seq !== seqRef.current) return;
        setUploading(false);
        awaitingValueRef.current = true;
      })
      .catch((uploadError) => {
        if (seq !== seqRef.current) return;
        setUploading(false);
        setError("Upload failed — please try again.");
        revoke();
        setPendingPreview(null);
        console.error(uploadError);
      });
  }

  function onInput(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) handleFile(file);
  }
  function onDragOver(event) {
    if (!onUpload || isUploading) return;
    event.preventDefault();
    setDragging(true);
  }
  function onDragLeave(event) {
    event.preventDefault();
    setDragging(false);
  }
  function onDrop(event) {
    if (!onUpload || isUploading) return;
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }

  if (!uploadable) {
    return (
      <div className="recordField recordMediaField">
        <span>{label}</span>
        {isImage && stringValue ? <img className="recordMediaPreview" src={stringValue} alt="" /> : null}
        {!isImage && stringValue ? <span className="recordFileName">{fileBasename(stringValue)}</span> : null}
        <p className="recordMediaNote">
          Editing this {isImage ? "image" : "file"} isn’t available inside a list yet.
        </p>
      </div>
    );
  }

  const previewSrc = isImage ? pendingPreview || stringValue || "" : "";

  return (
    <div className="recordField recordMediaField">
      <span>{label}</span>
      <label
        className={`imageDrop recordMediaDrop${isImage ? "" : " fileKind"}${isDragging ? " drag" : ""}${isUploading ? " uploading" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <input
          className="visuallyHidden"
          type="file"
          accept={isImage ? "image/*" : undefined}
          disabled={isUploading}
          onChange={onInput}
        />
        {isImage ? (
          previewSrc ? <img src={previewSrc} alt="" /> : <span className="imageDropEmpty">No image yet</span>
        ) : stringValue ? (
          <span className="recordFileName">{fileBasename(stringValue)}</span>
        ) : (
          <span className="imageDropEmpty">No file yet</span>
        )}
        <span className="imageDropHint">
          {isUploading ? (
            <><span className="spinner" aria-hidden="true" />Uploading…</>
          ) : isImage ? (
            "Drop an image, or click to replace"
          ) : (
            "Drop a file, or click to replace"
          )}
        </span>
      </label>
      {error ? <p className="imageError" role="alert">{error}</p> : null}
    </div>
  );
}

function fieldGroups(collection) {
  if (Array.isArray(collection?.groups) && collection.groups.length) {
    return collection.groups.map((group) => ({
      label: group.label,
      fields: Array.isArray(group.fields) ? group.fields : [],
    }));
  }
  return [{ label: null, fields: Array.isArray(collection?.fields) ? collection.fields : [] }];
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

function FieldControl({ field, value, onChange, onUploadFile, uploadable = true }) {
  const id = `record-field-${field.path}`;
  const label = field.label ?? humanizeFieldLabel(field.path);
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
            onUploadFile={onUploadFile}
            uploadable={uploadable}
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
                uploadable={false}
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
      <MediaField field={field} value={value} onUpload={onUploadFile} uploadable={uploadable} />
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

export function RecordPanel({ collection, record, recordData, isDraft = false, onFieldChange, onUploadFile, onClose, children }) {
  if (!record) return null;

  const groups = fieldGroups(collection);
  const hasFields = groups.some((group) => group.fields.length > 0);
  const title = recordTitle(collection, record.itemSlug, recordData);

  return (
    <aside className="recordPanel" aria-label={`Edit ${title}`}>
      <div className="recordPanelHead">
        <div className="recordPanelMeta">
          <span className="recordPanelEyebrow">{collection?.label ?? collection?.key ?? "Record"}</span>
          <span className="recordPanelTitle">{title}</span>
        </div>
        <button className="railClose" onClick={onClose} aria-label="Close record panel">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p className={`recordStatus${isDraft ? " draft" : ""}`} aria-live="polite">
        <span className="dot" />
        {isDraft ? "Draft — not published yet" : "Published — live on your site"}
      </p>

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
                    onUploadFile={onUploadFile}
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
