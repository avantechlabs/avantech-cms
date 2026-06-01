// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach } from "vitest";
import { expect, test, vi } from "vitest";
import { RecordPanel } from "./RecordPanel.jsx";

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "";
});

test("renders a selected collection record in a Done-style panel", () => {
  const html = renderToStaticMarkup(
    <RecordPanel
      collection={{ key: "projects", label: "Projects" }}
      record={{ collectionKey: "projects", itemSlug: "brand-refresh" }}
      onClose={() => {}}
    />,
  );

  expect(html).toContain("Projects");
  expect(html).toContain("brand-refresh");
  expect(html).toContain("No editable fields yet.");
  expect(html).toContain("Done");
  expect(html).not.toContain("Save");
});

test("renders grouped text fields from a collection definition", () => {
  const html = renderToStaticMarkup(
    <RecordPanel
      collection={{
        key: "projects",
        label: "Projects",
        groups: [
          {
            label: "Card",
            fields: [
              { path: "card.title", label: "Card title", type: "text" },
              { path: "card.description", label: "Card description", type: "textarea" },
            ],
          },
        ],
      }}
      record={{ collectionKey: "projects", itemSlug: "brand-refresh" }}
      recordData={{
        card: {
          title: "Brand refresh",
          description: "Published description",
        },
      }}
      onFieldChange={() => {}}
      onClose={() => {}}
    />,
  );

  expect(html).toContain("Card");
  expect(html).toContain("Card title");
  expect(html).toContain('value="Brand refresh"');
  expect(html).toContain("Card description");
  expect(html).toContain("Published description");
});

test("emits changed field path and value from simple controls", () => {
  const onFieldChange = vi.fn();
  document.body.innerHTML = `<div id="root"></div>`;

  act(() => {
    createRoot(document.getElementById("root")).render(
      <RecordPanel
        collection={{
          key: "projects",
          label: "Projects",
          fields: [{ path: "card.title", label: "Card title", type: "text" }],
        }}
        record={{ collectionKey: "projects", itemSlug: "brand-refresh" }}
        recordData={{ card: { title: "Brand refresh" } }}
        onFieldChange={onFieldChange}
        onClose={() => {}}
      />,
    );
  });

  const input = document.querySelector("input");
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(
      input,
      "Draft title",
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  expect(onFieldChange).toHaveBeenCalledWith("card.title", "Draft title");
});
