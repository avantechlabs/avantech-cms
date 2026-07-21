// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, test, vi } from "vitest";

const mutationState = vi.hoisted(() => ({ calls: [] }));

vi.mock("convex/react", () => ({
  useMutation: () => (args) => {
    mutationState.calls.push(args);
    if (args?.fieldId && !args?.fields) return Promise.resolve("https://upload.test/image");
    return Promise.resolve({});
  },
}));

import { useFieldManager } from "./useFieldManager.ts";

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mutationState.calls = [];
  document.body.innerHTML = "";
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ storageId: "slot-storage-id" }),
    }),
  );
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

test("seeds discovered fields for the selected editor language", async () => {
  function Consumer() {
    const { seedDiscoveredFields } = useFieldManager("project-a", "home", "en");
    return (
      <button
        type="button"
        onClick={() =>
          seedDiscoveredFields({
            projectSlug: "project-a",
            pageSlug: "home",
            fields: [{ id: "button.cta", value: "Contact us" }],
          })
        }
      >
        Seed
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
    fields: [{ id: "button.cta", value: "Contact us" }],
  });
});

test("seeds discovered image slot fields globally", async () => {
  function Consumer() {
    const { seedDiscoveredFields } = useFieldManager("project-a", "home", "fr");
    return (
      <button
        type="button"
        onClick={() =>
          seedDiscoveredFields({
            projectSlug: "project-a",
            pageSlug: "home",
            fields: [
              { id: "hero.title", value: "Bonjour" },
              { id: "hero.image.desktop", value: "/desktop.jpg", global: true },
              { id: "hero.image.mobile", value: "/mobile.jpg", global: true },
            ],
          })
        }
      >
        Seed
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
    language: "fr",
    fields: [{ id: "hero.title", value: "Bonjour" }],
  });
  expect(mutationState.calls).toContainEqual({
    projectSlug: "project-a",
    pageSlug: "home",
    fields: [
      { id: "hero.image.desktop", value: "/desktop.jpg" },
      { id: "hero.image.mobile", value: "/mobile.jpg" },
    ],
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

test("uploads image drafts as global slot fields", async () => {
  function Consumer() {
    const { uploadImageDraft } = useFieldManager("project-a", "home", "fr");
    return (
      <button
        type="button"
        onClick={() =>
          uploadImageDraft(
            "hero.image.mobile",
            new File(["mobile"], "mobile.png", { type: "image/png" }),
          )
        }
      >
        Upload
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

  expect(globalThis.fetch).toHaveBeenCalledWith("https://upload.test/image", {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: expect.any(File),
  });
  expect(mutationState.calls).toContainEqual({
    projectSlug: "project-a",
    pageSlug: "home",
    fieldId: "hero.image.mobile",
  });
  expect(mutationState.calls).toContainEqual({
    projectSlug: "project-a",
    pageSlug: "home",
    fields: { "hero.image.mobile": "convex-storage:slot-storage-id" },
  });
  expect(mutationState.calls).not.toContainEqual({
    projectSlug: "project-a",
    pageSlug: "home",
    language: "fr",
    fields: { "hero.image.mobile": "convex-storage:slot-storage-id" },
  });
});
