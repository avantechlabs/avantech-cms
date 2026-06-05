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
  expect(html).toContain("Brand refresh");
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

test("renders scalar controls from field definitions", () => {
  const html = renderToStaticMarkup(
    <RecordPanel
      collection={{
        key: "projects",
        label: "Projects",
        fields: [
          { path: "stats.count", label: "Count", type: "number" },
          { path: "featured", label: "Featured", type: "boolean" },
          { path: "status", label: "Status", type: "select", options: ["draft", "live"] },
          { path: "tags", label: "Tags", type: "multiSelect", options: ["brand", "film"] },
          { path: "url", label: "URL", type: "url" },
          { path: "email", label: "Email", type: "email" },
          { path: "date", label: "Date", type: "date" },
          { path: "publishedAt", label: "Published at", type: "datetime" },
          { path: "accent", label: "Accent", type: "color" },
          { path: "cover", label: "Cover", type: "image" },
          { path: "brief", label: "Brief", type: "file" },
          { path: "unknown", label: "Unknown", type: "relationship" },
        ],
      }}
      record={{ collectionKey: "projects", itemSlug: "brand-refresh" }}
      recordData={{
        stats: { count: 12 },
        featured: true,
        status: "live",
        tags: ["brand"],
        url: "https://example.com",
        email: "owner@example.com",
        date: "2026-06-01",
        publishedAt: "2026-06-01T10:00",
        accent: "#fdb714",
        cover: "/cover.jpg",
        brief: "/brief.pdf",
      }}
      onFieldChange={() => {}}
      onClose={() => {}}
    />,
  );

  expect(html).toContain('type="number"');
  expect(html).toContain('type="checkbox"');
  expect(html).toContain("<select");
  expect(html).toContain("multiple=");
  expect(html).toContain('type="url"');
  expect(html).toContain('type="email"');
  expect(html).toContain('type="date"');
  expect(html).toContain('type="datetime-local"');
  expect(html).toContain('type="color"');
  expect(html).toContain('accept="image/*"');
  expect(html).toContain("/cover.jpg");
  expect(html).toContain("brief.pdf");
  expect(html).toContain("Unsupported field type: relationship");
});

test("emits typed scalar values through the panel interface", () => {
  const onFieldChange = vi.fn();
  document.body.innerHTML = `<div id="root"></div>`;

  act(() => {
    createRoot(document.getElementById("root")).render(
      <RecordPanel
        collection={{
          key: "projects",
          label: "Projects",
          fields: [
            { path: "stats.count", label: "Count", type: "number" },
            { path: "featured", label: "Featured", type: "boolean" },
          ],
        }}
        record={{ collectionKey: "projects", itemSlug: "brand-refresh" }}
        recordData={{ stats: { count: 12 }, featured: false }}
        onFieldChange={onFieldChange}
        onClose={() => {}}
      />,
    );
  });

  const number = document.querySelector('input[type="number"]');
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(number, "42");
    number.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const checkbox = document.querySelector('input[type="checkbox"]');
  act(() => {
    checkbox.click();
  });

  expect(onFieldChange).toHaveBeenCalledWith("stats.count", 42);
  expect(onFieldChange).toHaveBeenCalledWith("featured", true);
});

test("renders object fields and emits nested object paths", () => {
  const onFieldChange = vi.fn();
  document.body.innerHTML = `<div id="root"></div>`;

  act(() => {
    createRoot(document.getElementById("root")).render(
      <RecordPanel
        collection={{
          key: "projects",
          label: "Projects",
          fields: [
            {
              path: "seo",
              label: "SEO",
              type: "object",
              fields: [{ path: "title", label: "SEO title", type: "text" }],
            },
          ],
        }}
        record={{ collectionKey: "projects", itemSlug: "brand-refresh" }}
        recordData={{ seo: { title: "Published SEO title" } }}
        onFieldChange={onFieldChange}
        onClose={() => {}}
      />,
    );
  });

  const input = document.querySelector("input");
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(
      input,
      "Draft SEO title",
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  expect(onFieldChange).toHaveBeenCalledWith("seo.title", "Draft SEO title");
});

test("adds and removes list items as draft operations", () => {
  const onFieldChange = vi.fn();
  document.body.innerHTML = `<div id="root"></div>`;

  act(() => {
    createRoot(document.getElementById("root")).render(
      <RecordPanel
        collection={{
          key: "projects",
          label: "Projects",
          fields: [
            {
              path: "benefits",
              label: "Benefits",
              type: "list",
              defaultItem: { title: "" },
              itemFields: [{ path: "title", label: "Title", type: "text" }],
            },
          ],
        }}
        record={{ collectionKey: "projects", itemSlug: "brand-refresh" }}
        recordData={{ benefits: [{ title: "First" }] }}
        onFieldChange={onFieldChange}
        onClose={() => {}}
      />,
    );
  });

  act(() => {
    [...document.querySelectorAll("button")].find((button) => button.textContent === "Add").click();
  });
  act(() => {
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent === "Remove")
      .click();
  });

  expect(onFieldChange).toHaveBeenCalledWith("benefits", [
    { title: "First" },
    { title: "" },
  ]);
  expect(onFieldChange).toHaveBeenCalledWith("benefits", []);
});
