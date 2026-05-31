import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api.js";

const PAGE_SLUG = "home";

export function useCmsProject(projectSlug: string) {
  const ensureSeedData = useMutation(api.cms.ensureSeedData);
  const projects = useQuery(api.cms.listProjects) ?? [];
  const project = useQuery(api.cms.getProjectBySlug, { slug: projectSlug });
  const previewFields = useQuery(
    api.cms.getPreviewContent,
    project ? { projectSlug, pageSlug: PAGE_SLUG } : "skip",
  );

  const previewOrigin = project?.origin ?? "";

  const siteUrl = useMemo(() => {
    if (!project) return "";
    const parent = encodeURIComponent(window.location.origin);
    const separator = project.editUrl.includes("?") ? "&" : "?";
    return `${project.editUrl}${separator}edit=1&parent=${parent}`;
  }, [project]);

  return { projects, project, previewFields, previewOrigin, siteUrl, ensureSeedData };
}
