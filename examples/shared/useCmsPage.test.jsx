// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const queryState = vi.hoisted(() => ({ result: undefined, calls: [] }));

vi.mock("convex/react", () => ({
  useQuery: (query, args) => {
    queryState.calls.push({ query, args });
    return queryState.result;
  },
}));

import {
  CmsCollectionsProvider,
  CmsContentProvider,
  CmsImage,
  CmsPagesProvider,
  useCmsCollection,
} from "./useCmsPage.jsx";

const parentOrigin = "http://cms.test";
const bridgeSource = readFileSync(resolve("packages/cms-bridge/bridge.js"), "utf8");
let postedMessages;

function renderWithCms(children) {
  return renderToStaticMarkup(
    <CmsContentProvider projectSlug="project-a" pageSlug="home">
      {children}
    </CmsContentProvider>,
  );
}

beforeEach(() => {
  queryState.result = undefined;
  queryState.calls = [];
  postedMessages = [];
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  window.history.replaceState({}, "", "/");
  vi.spyOn(window.parent, "postMessage").mockImplementation((message, origin) => {
    postedMessages.push({ message, origin });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
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

test("CmsContentProvider reads published fields for the selected language", () => {
  renderToStaticMarkup(
    <CmsContentProvider projectSlug="project-a" pageSlug="home" language="en">
      <main />
    </CmsContentProvider>,
  );

  expect(queryState.calls).toContainEqual({
    query: "cms:getPublishedContent",
    args: { projectSlug: "project-a", pageSlug: "home", language: "en" },
  });
});

test("CmsCollectionsProvider registers serializable definitions for the bridge", async () => {
  window.history.replaceState({}, "", `/?parent=${encodeURIComponent(parentOrigin)}`);
  document.body.innerHTML = `<div id="root"></div>`;

  await act(async () => {
    createRoot(document.getElementById("root")).render(
      <CmsCollectionsProvider
        collections={[
          {
            key: "projects",
            label: "Projects",
            recordCount: 2,
            titlePath: "card.title",
            slugPath: "slug",
            fields: [{ path: "card.title", label: "Card title", type: "text" }],
          },
        ]}
      >
        <main />
      </CmsCollectionsProvider>,
    );
  });

  window.eval(bridgeSource);

  expect(postedMessages).toContainEqual({
    origin: parentOrigin,
    message: {
      type: "cms:collections",
      collections: [
        {
          key: "projects",
          label: "Projects",
          recordCount: 2,
          titlePath: "card.title",
          slugPath: "slug",
          fields: [{ path: "card.title", label: "Card title", type: "text" }],
        },
      ],
    },
  });
});

test("CmsPagesProvider registers serializable page definitions for the bridge", async () => {
  window.history.replaceState({}, "", `/?parent=${encodeURIComponent(parentOrigin)}`);
  document.body.innerHTML = `<div id="root"></div>`;

  await act(async () => {
    createRoot(document.getElementById("root")).render(
      <CmsPagesProvider
        pages={[
          { slug: "home", title: "Home", path: "/" },
          { slug: "pricing", title: "Pricing", path: "/pricing" },
        ]}
      >
        <main />
      </CmsPagesProvider>,
    );
  });

  window.eval(bridgeSource);

  expect(postedMessages).toContainEqual({
    origin: parentOrigin,
    message: {
      type: "cms:pages",
      pages: [
        { slug: "home", title: "Home", path: "/" },
        { slug: "pricing", title: "Pricing", path: "/pricing" },
      ],
    },
  });
});

test("bridge exposes CMS language changes as site events", () => {
  window.history.replaceState({}, "", `/?parent=${encodeURIComponent(parentOrigin)}`);
  const languages = [];
  window.addEventListener("cms:language-changed", (event) => {
    languages.push(event.detail.language);
  });

  window.eval(bridgeSource);
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: parentOrigin,
      data: { type: "cms:set-language", language: "en" },
    }),
  );

  expect(languages).toContain("en");
});

test("useCmsCollection reads published records through a public string query", () => {
  queryState.result = [
    { slug: "brand-refresh", data: { card: { title: "Brand refresh" } } },
  ];
  let records;

  function CollectionConsumer() {
    records = useCmsCollection("project-a", "projects");
    return <span>{records[0].data.card.title}</span>;
  }

  const html = renderToStaticMarkup(<CollectionConsumer />);

  expect(html).toContain("Brand refresh");
  expect(records).toEqual([
    { slug: "brand-refresh", data: { card: { title: "Brand refresh" } } },
  ]);
  expect(queryState.calls).toContainEqual({
    query: "cms:listPublishedCollectionItems",
    args: { projectSlug: "project-a", collectionKey: "projects", language: "fr" },
  });
});

test("useCmsCollection can read records for a selected language", () => {
  queryState.result = [
    { slug: "brand-refresh", data: { card: { title: "Brand refresh" } } },
  ];

  function CollectionConsumer() {
    useCmsCollection("project-a", "projects", "en");
    return <span>Loaded</span>;
  }

  renderToStaticMarkup(<CollectionConsumer />);

  expect(queryState.calls).toContainEqual({
    query: "cms:listPublishedCollectionItems",
    args: { projectSlug: "project-a", collectionKey: "projects", language: "en" },
  });
});

test("useCmsCollection reads preview records in edit mode", () => {
  window.history.replaceState({}, "", "/?edit=1");
  queryState.result = [
    { slug: "draft-record", data: { card: { title: "Draft record" } } },
  ];
  let records;

  function CollectionConsumer() {
    records = useCmsCollection("project-a", "projects");
    return <span>{records[0].data.card.title}</span>;
  }

  const html = renderToStaticMarkup(<CollectionConsumer />);

  expect(html).toContain("Draft record");
  expect(records).toEqual([
    { slug: "draft-record", data: { card: { title: "Draft record" } } },
  ]);
  expect(queryState.calls).toContainEqual({
    query: "cms:listPreviewCollectionItems",
    args: { projectSlug: "project-a", collectionKey: "projects", language: "fr" },
  });
});
