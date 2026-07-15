// @vitest-environment jsdom
import { expect, test } from "vitest";
import { getCmsRoute } from "./main.jsx";

test("/cms opens the home route", () => {
  expect(getCmsRoute("/cms")).toEqual({ kind: "home" });
  expect(getCmsRoute("/cms/")).toEqual({ kind: "home" });
});

test("/cms/:slug opens that site's editor", () => {
  expect(getCmsRoute("/cms/project-a")).toEqual({
    kind: "site",
    projectSlug: "project-a",
    section: "editor",
  });
});

test("/cms/:slug/:section opens that site section", () => {
  expect(getCmsRoute("/cms/project-a/pages")).toEqual({
    kind: "site",
    projectSlug: "project-a",
    section: "pages",
  });
  expect(getCmsRoute("/cms/project-a/settings")).toEqual({
    kind: "site",
    projectSlug: "project-a",
    section: "settings",
  });
  expect(getCmsRoute("/cms/project-a/unknown")).toEqual({
    kind: "site",
    projectSlug: "project-a",
    section: "editor",
  });
});
