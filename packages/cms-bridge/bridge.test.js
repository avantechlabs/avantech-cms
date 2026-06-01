// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const parentOrigin = "http://cms.test";
const bridgeSource = readFileSync(resolve("packages/cms-bridge/bridge.js"), "utf8");

let postedMessages;

function installBridge() {
  window.eval(bridgeSource);
}

beforeEach(() => {
  postedMessages = [];
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  window.history.replaceState({}, "", `/?parent=${encodeURIComponent(parentOrigin)}`);
  vi.spyOn(window.parent, "postMessage").mockImplementation((message, origin) => {
    postedMessages.push({ message, origin });
  });
  globalThis.requestAnimationFrame = (callback) => {
    callback(0);
    return 1;
  };
  window.requestAnimationFrame = globalThis.requestAnimationFrame;
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("bridge discovers image fields from src and text fields from text content", () => {
  document.body.innerHTML = `
    <img data-cms-field="hero.image" src="/images/static-hero.jpg" alt="">
    <p data-cms-field="hero.title">Static title</p>
  `;

  installBridge();

  const fieldsMessage = postedMessages.find(({ message }) => message.type === "cms:fields");
  expect(fieldsMessage.origin).toBe(parentOrigin);
  expect(fieldsMessage.message.fields).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "hero.image",
        kind: "image",
        value: "/images/static-hero.jpg",
        editable: true,
      }),
      expect.objectContaining({
        id: "hero.title",
        kind: "text",
        value: "Static title",
        editable: true,
      }),
    ]),
  );
});

test("bridge discovers record regions with collection key, item slug, and geometry", () => {
  document.body.innerHTML = `
    <article data-cms-record="projects:brand-refresh">
      <h2>Brand refresh</h2>
    </article>
  `;
  const record = document.querySelector("[data-cms-record]");
  record.getBoundingClientRect = () => ({
    left: 10,
    top: 20,
    width: 300,
    height: 120,
    right: 310,
    bottom: 140,
    x: 10,
    y: 20,
    toJSON: () => {},
  });

  installBridge();

  const recordsMessage = postedMessages
    .filter(({ message }) => message.type === "cms:records")
    .at(-1);
  expect(recordsMessage.origin).toBe(parentOrigin);
  expect(recordsMessage.message.records).toEqual([
    {
      collectionKey: "projects",
      itemSlug: "brand-refresh",
      rect: { left: 10, top: 20, width: 300, height: 120 },
    },
  ]);
});

test("bridge reports image field clicks with image kind", () => {
  document.body.innerHTML = `<img data-cms-field="hero.image" src="/images/static-hero.jpg" alt="">`;
  installBridge();

  document
    .querySelector('[data-cms-field="hero.image"]')
    .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

  expect(postedMessages).toContainEqual({
    origin: parentOrigin,
    message: {
      type: "cms:field-clicked",
      fieldId: "hero.image",
      kind: "image",
    },
  });
});

test("bridge reports clicks inside record regions", () => {
  document.body.innerHTML = `
    <article data-cms-record="projects:brand-refresh">
      <button>Open project</button>
    </article>
  `;
  installBridge();

  document.querySelector("button").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

  expect(postedMessages).toContainEqual({
    origin: parentOrigin,
    message: {
      type: "cms:record-clicked",
      collectionKey: "projects",
      itemSlug: "brand-refresh",
    },
  });
});

test("record regions take priority over nested editable fields", () => {
  document.body.innerHTML = `
    <article data-cms-record="projects:brand-refresh">
      <h2 data-cms-field="projects.brand-refresh.card.title">Brand refresh</h2>
    </article>
  `;
  installBridge();

  document
    .querySelector('[data-cms-field="projects.brand-refresh.card.title"]')
    .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

  expect(postedMessages).toContainEqual({
    origin: parentOrigin,
    message: {
      type: "cms:record-clicked",
      collectionKey: "projects",
      itemSlug: "brand-refresh",
    },
  });
  expect(postedMessages).not.toContainEqual({
    origin: parentOrigin,
    message: {
      type: "cms:field-clicked",
      fieldId: "projects.brand-refresh.card.title",
      kind: "text",
    },
  });
  expect(postedMessages).not.toContainEqual({
    origin: parentOrigin,
    message: {
      type: "cms:editing",
      fieldId: "projects.brand-refresh.card.title",
    },
  });
});

test("standalone page fields outside records remain inline editable", () => {
  document.body.innerHTML = `<h1 data-cms-field="hero.title">Static title</h1>`;
  installBridge();

  document
    .querySelector('[data-cms-field="hero.title"]')
    .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

  expect(document.querySelector('[data-cms-field="hero.title"]').contentEditable).toBe(
    "plaintext-only",
  );
  expect(postedMessages).toContainEqual({
    origin: parentOrigin,
    message: {
      type: "cms:field-clicked",
      fieldId: "hero.title",
      kind: "text",
    },
  });
  expect(postedMessages).toContainEqual({
    origin: parentOrigin,
    message: {
      type: "cms:editing",
      fieldId: "hero.title",
    },
  });
});

test("bridge applies image field values to src and text field values to textContent", () => {
  document.body.innerHTML = `
    <img data-cms-field="hero.image" src="/images/static-hero.jpg" alt="">
    <p data-cms-field="hero.title">Static title</p>
  `;
  installBridge();

  window.dispatchEvent(
    new MessageEvent("message", {
      origin: parentOrigin,
      data: {
        type: "cms:apply-fields",
        fields: {
          "hero.image": "/images/published-hero.jpg",
          "hero.title": "Published title",
        },
      },
    }),
  );

  expect(document.querySelector('[data-cms-field="hero.image"]').getAttribute("src")).toBe(
    "/images/published-hero.jpg",
  );
  expect(document.querySelector('[data-cms-field="hero.title"]').textContent).toBe(
    "Published title",
  );
});
