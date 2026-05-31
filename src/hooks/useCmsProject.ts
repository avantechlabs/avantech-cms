import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api.js";

const PAGE_SLUG = "home";

export function useCmsProject(projectSlug: string) {
  const ensureSeedData = useMutation(api.cms.ensureSeedData);
  const projects = useQuery(api.cms.listProjects) ?? [];
  const project = useQuery(api.cms.getProjectBySlug, { slug: projectSlug });

  // getPage returns draft + published separately, so the change-count and the
  // draft-vs-live markers are derived from real persisted state, not a guess.
  const page = useQuery(
    api.cms.getPage,
    project ? { projectSlug, pageSlug: PAGE_SLUG } : "skip",
  );

  const publishedFields = page?.publishedFields ?? {};
  const draftFields = page?.draftFields ?? {};

  const previewFields = useMemo(
    () => ({ ...publishedFields, ...draftFields }),
    [page],
  );
  // Only count a draft as an unpublished change when it actually differs from
  // the live value — a draft equal to published is a no-op, not a change.
  const draftFieldIds = useMemo(
    () => Object.keys(draftFields).filter((id) => draftFields[id] !== publishedFields[id]),
    [page],
  );

  const previewOrigin = project?.origin ?? "";

  const siteUrl = useMemo(() => {
    if (!project) return "";
    const parent = encodeURIComponent(window.location.origin);
    const separator = project.editUrl.includes("?") ? "&" : "?";
    return `${project.editUrl}${separator}edit=1&parent=${parent}`;
  }, [project]);

  return {
    projects,
    project,
    publishedFields,
    previewFields,
    draftFieldIds,
    previewOrigin,
    siteUrl,
    ensureSeedData,
  };
}
