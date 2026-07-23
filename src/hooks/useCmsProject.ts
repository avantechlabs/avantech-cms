import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api.js";

type PreviewTarget = {
  previewOrigin: string;
  siteUrl: string;
  previewError: string | null;
};

export function buildPreviewTarget({
  projectSiteUrl,
  pagePath,
  pageSlug,
  language,
  cmsOrigin,
}: {
  projectSiteUrl: string | undefined;
  pagePath: string | undefined;
  pageSlug: string;
  language: string;
  cmsOrigin: string;
}): PreviewTarget {
  const trimmedSiteUrl = projectSiteUrl?.trim();
  if (!trimmedSiteUrl) {
    return { previewOrigin: "", siteUrl: "", previewError: null };
  }

  let url: URL;
  try {
    url = new URL(trimmedSiteUrl, cmsOrigin);
  } catch {
    return {
      previewOrigin: "",
      siteUrl: "",
      previewError: "Enter a valid site URL in settings.",
    };
  }

  if (url.origin === cmsOrigin) {
    return {
      previewOrigin: "",
      siteUrl: "",
      previewError: "Site URL points to the CMS. Set it to the public site URL in settings.",
    };
  }

  const resolvedPagePath = pagePath ?? (pageSlug === "home" ? "/" : `/${pageSlug}`);
  url.pathname = resolvedPagePath.startsWith("/") ? resolvedPagePath : `/${resolvedPagePath}`;
  url.searchParams.set("edit", "1");
  url.searchParams.set("parent", cmsOrigin);
  url.searchParams.set("cmsLanguage", language);

  return {
    previewOrigin: url.origin,
    siteUrl: url.toString(),
    previewError: null,
  };
}

export function projectSiteUrl(project: {
  siteUrl?: string;
  editUrl?: string;
  origin?: string;
} | null | undefined) {
  return project?.siteUrl ?? project?.editUrl ?? project?.origin ?? "";
}

export function useCmsProject(
  projectSlug: string,
  pageSlug: string,
  language = "en",
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

  const previewTarget = useMemo(
    () =>
      buildPreviewTarget({
        projectSiteUrl: projectSiteUrl(project),
        pagePath: page?.page?.path,
        pageSlug,
        language,
        cmsOrigin: window.location.origin,
      }),
    [language, page?.page?.path, pageSlug, project],
  );

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
    previewOrigin: previewTarget.previewOrigin,
    siteUrl: previewTarget.siteUrl,
    previewError: previewTarget.previewError,
    ensureSeedData,
  };
}
