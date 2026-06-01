// @vitest-environment jsdom
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { CollectionsRailSection } from "./CollectionsRailSection.jsx";

test("renders collection rows with owner-facing labels and counts", () => {
  const html = renderToStaticMarkup(
    <CollectionsRailSection
      collections={[
        { key: "projects", label: "Projects", recordCount: 2 },
        { key: "team", label: "Team", recordCount: 4 },
      ]}
    />,
  );

  expect(html).toContain("Collections");
  expect(html).toContain("Projects");
  expect(html).toContain("Team");
  expect(html).toContain("2");
  expect(html).toContain("4");
  expect(html).not.toContain("No collections yet");
});
