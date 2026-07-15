import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api.js";
import { navigate } from "../lib/router.js";

function normalizeSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function SiteSettings({ project }) {
  const createProject = useMutation(api.cms.createProject);
  const updateProject = useMutation(api.cms.updateProject);
  const addSiteOwner = useMutation(api.cms.addSiteOwner);
  const removeSiteOwner = useMutation(api.cms.removeSiteOwner);

  const [draft, setDraft] = useState({
    slug: project?.slug ?? "",
    name: project?.name ?? "",
    origin: project?.origin ?? "",
    editUrl: project?.editUrl ?? "",
  });
  const [saveState, setSaveState] = useState("idle");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerState, setOwnerState] = useState("idle");
  const [confirmingRemoval, setConfirmingRemoval] = useState(null);

  const ownerEmails = useQuery(
    api.cms.listSiteOwners,
    project ? { projectSlug: project.slug } : "skip",
  ) ?? [];

  useEffect(() => {
    if (!confirmingRemoval) return undefined;
    const timer = setTimeout(() => setConfirmingRemoval(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmingRemoval]);

  const canSave =
    draft.slug.trim() &&
    draft.name.trim() &&
    draft.origin.trim() &&
    draft.editUrl.trim() &&
    saveState !== "saving";

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event) {
    event.preventDefault();
    if (!canSave) return;

    const payload = {
      slug: project ? project.slug : normalizeSlug(draft.slug),
      name: draft.name.trim(),
      origin: draft.origin.trim(),
      editUrl: draft.editUrl.trim(),
    };

    setSaveState("saving");
    const action = project ? updateProject(payload) : createProject(payload);
    action
      .then((saved) => {
        if (!project && saved?.slug) {
          navigate(`/cms/${saved.slug}/settings`);
          return;
        }
        setSaveState("saved");
      })
      .catch((error) => {
        console.error(error);
        setSaveState("error");
      });
  }

  function onAddOwner(event) {
    event?.preventDefault();
    if (!project || !ownerEmail.trim() || ownerState === "saving") return;

    setOwnerState("saving");
    addSiteOwner({ projectSlug: project.slug, email: ownerEmail })
      .then(() => {
        setOwnerEmail("");
        setOwnerState("saved");
      })
      .catch((error) => {
        console.error(error);
        setOwnerState("error");
      });
  }

  function onRemoveOwner(email) {
    if (!project) return;
    if (confirmingRemoval !== email) {
      setConfirmingRemoval(email);
      return;
    }
    setConfirmingRemoval(null);
    setOwnerState("saving");
    removeSiteOwner({ projectSlug: project.slug, email })
      .then(() => setOwnerState("saved"))
      .catch((error) => {
        console.error(error);
        setOwnerState("error");
      });
  }

  return (
    <div className="viewShell">
      <header className="viewHead">
        <div>
          <p className="adminEyebrow">{project ? project.name : "Avantech CMS · Admin"}</p>
          <h1>{project ? "Site settings" : "Create a site"}</h1>
          {!project && (
            <p className="accessLede">Register a paid customer’s site so they can start editing.</p>
          )}
        </div>
      </header>

      <form className="adminPanel projectForm" onSubmit={onSubmit}>
        <div className="adminPanelHead">
          <h2>Connection</h2>
          {saveState === "saved" && <span className="savePill">Saved</span>}
          {saveState === "error" && <span className="savePill error">Couldn’t save</span>}
        </div>

        <label>
          <span>Name</span>
          <input
            value={draft.name}
            onChange={(event) => updateDraft("name", event.target.value)}
            placeholder="Sable"
          />
        </label>

        <label>
          <span>Slug</span>
          <input
            value={draft.slug}
            onChange={(event) => updateDraft("slug", normalizeSlug(event.target.value))}
            placeholder="sable"
            disabled={Boolean(project)}
          />
        </label>

        <label>
          <span>Origin</span>
          <input
            value={draft.origin}
            onChange={(event) => updateDraft("origin", event.target.value)}
            placeholder="https://sable.com"
          />
        </label>

        <label>
          <span>Edit URL</span>
          <input
            value={draft.editUrl}
            onChange={(event) => updateDraft("editUrl", event.target.value)}
            placeholder="https://sable.com"
          />
        </label>

        <div className="adminActions">
          <button className="barBtn primary" type="submit" disabled={!canSave}>
            {saveState === "saving" ? "Saving…" : project ? "Save changes" : "Create site"}
          </button>
        </div>

        {project && (
          <section className="ownerManager" aria-label="Site owners">
            <div className="adminPanelHead">
              <h2>Site owners</h2>
              {ownerState === "saved" && <span className="savePill">Saved</span>}
              {ownerState === "error" && <span className="savePill error">Couldn’t update</span>}
            </div>
            <div className="ownerAdd">
              <label>
                <span>Owner email</span>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(event) => setOwnerEmail(event.target.value)}
                  placeholder="owner@example.com"
                />
              </label>
              <button
                className="barBtn"
                type="button"
                onClick={onAddOwner}
                disabled={!ownerEmail.trim() || ownerState === "saving"}
              >
                Add owner
              </button>
            </div>
            <p className="ownerHint">
              No invite email is sent — they get access as soon as they sign in with this
              exact email.
            </p>
            <div className="ownerList">
              {ownerEmails.length > 0 ? (
                ownerEmails.map((email) => (
                  <div className="ownerRow" key={email}>
                    <span>{email}</span>
                    <button
                      className={`barBtn${confirmingRemoval === email ? " danger" : ""}`}
                      type="button"
                      onClick={() => onRemoveOwner(email)}
                      disabled={ownerState === "saving"}
                    >
                      {confirmingRemoval === email ? "Remove access?" : "Remove"}
                    </button>
                  </div>
                ))
              ) : (
                <p className="adminEmpty">
                  No site owners yet — add the customer’s email above.
                </p>
              )}
            </div>
          </section>
        )}
      </form>
    </div>
  );
}
