// @vitest-environment jsdom
import React, { useEffect } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, test, vi } from "vitest";
import { useIframeMessaging } from "./useIframeMessaging.ts";

const previewOrigin = "https://site.test";

let latest;

function Consumer({ frameKey }) {
  latest = useIframeMessaging({
    previewOrigin,
    projectSlug: "project-a",
    pageSlug: "home",
    frameKey,
    onReady: () => {},
    onFields: () => {},
    onFieldClicked: () => {},
    onFieldChanged: () => {},
    onEditing: () => {},
  });

  useEffect(() => {
    latest.iframeRef.current.contentWindow.postMessage = vi.fn();
  }, [frameKey]);

  return <iframe ref={latest.iframeRef} title="Preview" />;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  latest = null;
  document.body.innerHTML = "";
});

test("queues messages again when the iframe frame key changes", () => {
  const root = createRoot(document.body.appendChild(document.createElement("div")));

  act(() => {
    root.render(<Consumer frameKey="fr" />);
  });

  const firstPostMessage = latest.iframeRef.current.contentWindow.postMessage;
  act(() => {
    latest.send({ type: "cms:set-language", language: "fr" });
  });
  expect(firstPostMessage).not.toHaveBeenCalled();

  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: previewOrigin,
        data: { type: "cms:ready" },
      }),
    );
  });
  expect(firstPostMessage).toHaveBeenCalledWith(
    { type: "cms:set-language", language: "fr" },
    previewOrigin,
  );

  act(() => {
    latest.send({ type: "cms:set-mode", mode: "edit" });
  });
  expect(firstPostMessage).toHaveBeenCalledWith(
    { type: "cms:set-mode", mode: "edit" },
    previewOrigin,
  );

  act(() => {
    root.render(<Consumer frameKey="en" />);
  });

  const secondPostMessage = latest.iframeRef.current.contentWindow.postMessage;
  act(() => {
    latest.send({ type: "cms:set-language", language: "en" });
  });
  expect(secondPostMessage).not.toHaveBeenCalled();

  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: previewOrigin,
        data: { type: "cms:ready" },
      }),
    );
  });
  expect(secondPostMessage).toHaveBeenCalledWith(
    { type: "cms:set-language", language: "en" },
    previewOrigin,
  );
});
