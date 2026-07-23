// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, test, vi } from "vitest";

const queryState = vi.hoisted(() => ({
  calls: [],
  project: { siteUrl: "http://localhost:51741" },
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: (_query, args) => {
    queryState.calls.push(args);
    if (args === undefined) return [];
    if (args === "skip") return undefined;
    if (args?.slug) {
      return {
        slug: args.slug,
        name: "Project A",
        ...queryState.project,
      };
    }
    if (args?.projectSlug && !args.pageSlug) return [];
    if (args?.projectSlug && args?.pageSlug) {
      return {
        page: { slug: args.pageSlug, title: "Home", path: "/" },
        language: args.language,
        publishedFields: {},
        draftFields: {},
      };
    }
    return undefined;
  },
}));

import { useCmsProject } from "./useCmsProject.ts";

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  queryState.calls = [];
  queryState.project = { siteUrl: "http://localhost:51741" };
  document.body.innerHTML = "";
});

function renderHook() {
  let result;
  function Consumer() {
    result = useCmsProject("project-a", "home", "en");
    return null;
  }

  act(() => {
    createRoot(document.body.appendChild(document.createElement("div"))).render(
      <Consumer />
    );
  });

  return result;
}

test("loads page state for the selected editor language", () => {
  const result = renderHook();

  expect(queryState.calls).toContainEqual({
    projectSlug: "project-a",
    pageSlug: "home",
    language: "en",
  });
  expect(result.pageLanguage).toBe("en");
  expect(result.previewOrigin).toBe("http://localhost:51741");
  expect(result.siteUrl).toContain("http://localhost:51741/");
  expect(result.siteUrl).toContain("cmsLanguage=en");
  expect(result.previewError).toBeNull();
});

test("blocks preview URLs that point back to the CMS", () => {
  queryState.project = { siteUrl: window.location.origin };

  const result = renderHook();

  expect(result.previewOrigin).toBe("");
  expect(result.siteUrl).toBe("");
  expect(result.previewError).toContain("Site URL points to the CMS");
});

test("builds preview URLs from legacy editUrl project records", () => {
  queryState.project = {
    origin: "http://localhost:51742",
    editUrl: "http://localhost:51742",
  };

  const result = renderHook();

  expect(result.previewOrigin).toBe("http://localhost:51742");
  expect(result.siteUrl).toContain("http://localhost:51742/");
  expect(result.siteUrl).toContain("cmsLanguage=en");
  expect(result.previewError).toBeNull();
});
