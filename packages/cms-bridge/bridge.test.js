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
