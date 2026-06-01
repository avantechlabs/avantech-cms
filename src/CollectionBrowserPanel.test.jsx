// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import { CollectionBrowserPanel } from "./CollectionBrowserPanel.jsx";

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "";
});

test("renders collection records and a create form", () => {
  const html = renderToStaticMarkup(
    <CollectionBrowserPanel
      collection={{ key: "projects", label: "Projects" }}
      records={[{ slug: "brand-refresh", data: {} }]}
      onCreate={() => {}}
      onSelectRecord={() => {}}
      onClose={() => {}}
    />,
  );

  expect(html).toContain("Projects");
  expect(html).toContain("brand-refresh");
  expect(html).toContain("New record slug");
  expect(html).toContain("Create");
});

test("marks records with unpublished drafts", () => {
  const html = renderToStaticMarkup(
    <CollectionBrowserPanel
      collection={{ key: "projects", label: "Projects" }}
      records={[{ slug: "brand-refresh", data: {} }]}
      draftSlugs={["brand-refresh"]}
      onCreate={() => {}}
      onSelectRecord={() => {}}
      onClose={() => {}}
    />,
  );

  expect(html).toContain("draftDot");
});


test("creates a draft record from the entered slug", () => {
  const onCreate = vi.fn();
  document.body.innerHTML = `<div id="root"></div>`;

  act(() => {
    createRoot(document.getElementById("root")).render(
      <CollectionBrowserPanel
        collection={{ key: "projects", label: "Projects" }}
        records={[]}
        onCreate={onCreate}
        onSelectRecord={() => {}}
        onClose={() => {}}
      />,
    );
  });

  const input = document.querySelector("input");
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(
      input,
      "new-project",
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  document.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true }));

  expect(onCreate).toHaveBeenCalledWith("new-project");
});
