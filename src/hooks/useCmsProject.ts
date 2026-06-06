import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api.js";

export function useCmsProject(
  projectSlug: string,
  pageSlug: string,
  language = "fr",
) {
  const ensureSeedData = useMutation(api.cms.ensureSeedData);
  const projects = useQuery(api.cms.listProjects) ?? [];
  const project = useQuery(api.cms.getProjectBySlug, { slug: projectSlug });
  const pages = useQuery(
    api.cms.listPages,
    project ? { projectSlug } : "skip",
  ) ?? [];

  // getPage returns draft + published separately, so the change-count and the
  // draft-vs-live markers are derived from real persisted state, not a guess.
  const page = useQuery(
    api.cms.getPage,
    project ? { projectSlug, pageSlug, language } : "skip",
  );
  const siteDraftState = useQuery(
    api.cms.getSiteDraftState,
    project ? { projectSlug, pageSlug, language } : "skip",
  );

  const publishedFields = page?.publishedFields ?? {};
  const draftFields = page?.draftFields ?? {};
  const pageLanguage = page?.language ?? null;

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
    const pagePath = page?.page?.path ?? (pageSlug === "home" ? "/" : `/${pageSlug}`);
    const url = new URL(project.editUrl, window.location.origin);
    url.pathname = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
    url.searchParams.set("edit", "1");
    url.searchParams.set("parent", window.location.origin);
    url.searchParams.set("cmsLanguage", language);
    return url.toString();
  }, [language, page?.page?.path, pageSlug, project]);

  return {
    projects,
    project,
    page: page?.page ?? null,
    pages,
    publishedFields,
    previewFields,
    pageLanguage,
    draftFieldIds,
    siteDraftCount: siteDraftState?.totalDraftCount ?? draftFieldIds.length,
    collectionDrafts: siteDraftState?.collectionDrafts ?? [],
    previewOrigin,
    siteUrl,
    ensureSeedData,
  };
}
