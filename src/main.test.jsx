// @vitest-environment jsdom
import { expect, test } from "vitest";
import { getCmsRoute } from "./main.jsx";

test("/cms opens the site access dashboard", () => {
  expect(getCmsRoute("/cms")).toEqual({ kind: "dashboard" });
  expect(getCmsRoute("/cms/")).toEqual({ kind: "dashboard" });
});

test("/cms/:slug opens that site editor route", () => {
  expect(getCmsRoute("/cms/project-a")).toEqual({
    kind: "editor",
    projectSlug: "project-a",
  });
});
