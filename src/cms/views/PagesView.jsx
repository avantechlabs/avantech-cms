import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api.js";

export function PagesView({ project }) {
  const pages = useQuery(api.cms.listPages, { projectSlug: project.slug });

  return (
    <div className="viewShell">
      <header className="viewHead">
        <div>
          <p className="adminEyebrow">{project.name}</p>
          <h1>Pages</h1>
          <p className="accessLede">Open a page in the editor to change its content.</p>
        </div>
      </header>

      {pages === undefined ? (
        <p className="adminEmpty">Loading pages…</p>
      ) : pages.length === 0 ? (
        <p className="adminEmpty">No pages yet — they appear here once your site connects.</p>
      ) : (
        <div className="pageList">
          {pages.map((page) => (
            <a
              key={page.slug}
              className="pageRow"
              href={`/cms/${project.slug}?page=${encodeURIComponent(page.slug)}`}
            >
              <span className="pageTitle">{page.title}</span>
              {page.draftCount > 0 ? (
                <span className="pageDraft">
                  {page.draftCount} unpublished
                </span>
              ) : (
                <span className="pageLive">live</span>
              )}
              <span className="pagePath">{page.path ?? `/${page.slug}`}</span>
              <span className="pageGo" aria-hidden="true">Edit →</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
