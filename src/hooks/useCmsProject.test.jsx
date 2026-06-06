// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, test, vi } from "vitest";

const queryState = vi.hoisted(() => ({ calls: [] }));

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
        origin: "https://site.test",
        editUrl: "https://site.test",
      };
    }
    if (args?.projectSlug && !args.pageSlug) return [];
    if (args?.projectSlug && args?.pageSlug) {
      return {
        page: { slug: args.pageSlug, title: "Home", path: "/" },
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
  document.body.innerHTML = "";
});

test("loads page state for the selected editor language", () => {
  function Consumer() {
    useCmsProject("project-a", "home", "en");
    return null;
  }

  act(() => {
    createRoot(document.body.appendChild(document.createElement("div"))).render(
      <Consumer />,
    );
  });

  expect(queryState.calls).toContainEqual({
    projectSlug: "project-a",
    pageSlug: "home",
    language: "en",
  });
});
