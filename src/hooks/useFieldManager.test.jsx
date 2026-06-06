// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, test, vi } from "vitest";

const mutationState = vi.hoisted(() => ({ calls: [] }));

vi.mock("convex/react", () => ({
  useMutation: () => (args) => {
    mutationState.calls.push(args);
    return Promise.resolve({});
  },
}));

import { useFieldManager } from "./useFieldManager.ts";

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mutationState.calls = [];
  document.body.innerHTML = "";
});

test("saves page draft fields for the selected editor language", async () => {
  function Consumer() {
    const { saveDraftField } = useFieldManager("project-a", "home", "en");
    return (
      <button type="button" onClick={() => saveDraftField("button.cta", "Contact us")}>
        Save
      </button>
    );
  }

  await act(async () => {
    createRoot(document.body.appendChild(document.createElement("div"))).render(
      <Consumer />,
    );
  });

  await act(async () => {
    document.querySelector("button").click();
  });

  expect(mutationState.calls).toContainEqual({
    projectSlug: "project-a",
    pageSlug: "home",
    language: "en",
    fields: { "button.cta": "Contact us" },
  });
});

test("publishes and discards page drafts for the selected editor language", async () => {
  function Consumer() {
    const { publish, discard } = useFieldManager("project-a", "home", "en");
    return (
      <>
        <button type="button" onClick={() => publish()}>
          Publish
        </button>
        <button type="button" onClick={() => discard()}>
          Discard
        </button>
      </>
    );
  }

  await act(async () => {
    createRoot(document.body.appendChild(document.createElement("div"))).render(
      <Consumer />,
    );
  });

  await act(async () => {
    document.querySelectorAll("button")[0].click();
  });
  await act(async () => {
    document.querySelectorAll("button")[1].click();
  });

  expect(mutationState.calls).toContainEqual({
    projectSlug: "project-a",
    pageSlug: "home",
    language: "en",
  });
  expect(
    mutationState.calls.filter(
      (call) =>
        call?.projectSlug === "project-a" &&
        call?.pageSlug === "home" &&
        call?.language === "en" &&
        !("fields" in call),
    ),
  ).toHaveLength(2);
});
