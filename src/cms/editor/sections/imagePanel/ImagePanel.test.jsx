// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import { ImagePanel } from "./ImagePanel.tsx";

function slots() {
  return [
    {
      id: "hero.image.desktop",
      title: "Desktop",
      previewSrc: "/desktop.jpg",
      isDraft: false,
      isDragging: false,
      isUploading: false,
      error: null,
    },
    {
      id: "hero.image.mobile",
      title: "Mobile",
      previewSrc: "/mobile.jpg",
      isDraft: true,
      isDragging: false,
      isUploading: false,
      error: null,
    },
  ];
}

test("ImagePanel renders one upload area per image slot", () => {
  const html = renderToStaticMarkup(
    <ImagePanel
      cardRef={{ current: null }}
      imageTitle="Hero image"
      inputRef={{ current: null }}
      slots={slots()}
      onChooseImage={() => {}}
      onClose={() => {}}
      onDragLeave={() => {}}
      onDragOver={() => {}}
      onDrop={() => {}}
      onFileChange={() => {}}
    />,
  );

  expect(html).toContain("Hero image");
  expect(html).toContain("Desktop");
  expect(html).toContain("Mobile");
  expect(html).toContain("/desktop.jpg");
  expect(html).toContain("/mobile.jpg");
  expect(html).toContain("Published — live on your site");
  expect(html).toContain("Draft — not published yet");
});

test("ImagePanel chooses the slot whose upload control was clicked", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = `<div id="root"></div>`;
  const onChooseImage = vi.fn();

  await act(async () => {
    createRoot(document.getElementById("root")).render(
      <ImagePanel
        cardRef={{ current: null }}
        imageTitle="Hero image"
        inputRef={{ current: null }}
        slots={slots()}
        onChooseImage={onChooseImage}
        onClose={() => {}}
        onDragLeave={() => {}}
        onDragOver={() => {}}
        onDrop={() => {}}
        onFileChange={() => {}}
      />,
    );
  });

  await act(async () => {
    document.querySelector('[aria-label="Replace Mobile image"]').click();
  });

  expect(onChooseImage).toHaveBeenCalledWith("hero.image.mobile");
});
