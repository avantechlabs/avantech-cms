// @vitest-environment jsdom
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RecordPanel } from "./RecordPanel.jsx";

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
  expect(html).toContain("Record editor coming next.");
  expect(html).toContain("Done");
  expect(html).not.toContain("Save");
});
