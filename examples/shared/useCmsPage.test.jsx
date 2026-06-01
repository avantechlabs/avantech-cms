// @vitest-environment jsdom
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const queryState = vi.hoisted(() => ({ result: undefined }));

vi.mock("convex/react", () => ({
  useQuery: () => queryState.result,
}));

import { CmsContentProvider, CmsImage } from "./useCmsPage.jsx";

function renderWithCms(children) {
  return renderToStaticMarkup(
    <CmsContentProvider projectSlug="project-a" pageSlug="home">
      {children}
    </CmsContentProvider>,
  );
}

beforeEach(() => {
  queryState.result = undefined;
  window.history.replaceState({}, "", "/");
});

test("CmsImage renders the published image value in public mode", () => {
  queryState.result = { "hero.image": "/published-hero.jpg" };

  const html = renderWithCms(
    <CmsImage fieldId="hero.image" src="/fallback-hero.jpg" alt="Hero" className="hero-img" />,
  );

  expect(html).toContain('data-cms-field="hero.image"');
  expect(html).toContain('src="/published-hero.jpg"');
  expect(html).toContain('alt="Hero"');
});

test("CmsImage throws when a published image value is missing", () => {
  queryState.result = {};

  expect(() =>
    renderWithCms(<CmsImage fieldId="hero.image" src="/fallback-hero.jpg" alt="Hero" />),
  ).toThrow("Missing published CMS value for project-a/home:hero.image");
});

test("CmsImage keeps the fallback src available for edit-mode discovery", () => {
  queryState.result = {};
  window.history.replaceState({}, "", "/?edit=1");

  const html = renderWithCms(
    <CmsImage fieldId="hero.image" src="/fallback-hero.jpg" alt="Hero" />,
  );

  expect(html).toContain('data-cms-field="hero.image"');
  expect(html).toContain('src="/fallback-hero.jpg"');
});
