// @vitest-environment node
import { describe, expect, test } from "vitest";
import { checkProdEnv } from "./checkProdEnv.js";

const prodUrl = "https://prod-cms.example.com";
const devUrl = "https://dev-cms.example.com";

describe("production Convex env guard", () => {
  test("production passes with the production CMS URL", () => {
    expect(
      checkProdEnv({
        VERCEL_ENV: "production",
        VITE_CONVEX_URL: prodUrl,
        PROD_CMS_CONVEX_URL: prodUrl,
      }),
    ).toEqual({ ok: true });
  });

  test("production fails with the dev CMS URL", () => {
    expect(
      checkProdEnv({
        VERCEL_ENV: "production",
        VITE_CONVEX_URL: devUrl,
        PROD_CMS_CONVEX_URL: prodUrl,
      }),
    ).toEqual({
      ok: false,
      message:
        "Production builds must use PROD_CMS_CONVEX_URL for VITE_CONVEX_URL.",
    });
  });

  test("preview and local builds may use the dev CMS URL", () => {
    expect(
      checkProdEnv({
        VERCEL_ENV: "preview",
        VITE_CONVEX_URL: devUrl,
        PROD_CMS_CONVEX_URL: prodUrl,
      }),
    ).toEqual({ ok: true });
  });

  test("production fails when required values are missing", () => {
    expect(checkProdEnv({ VERCEL_ENV: "production" })).toEqual({
      ok: false,
      message:
        "Production builds require VITE_CONVEX_URL and PROD_CMS_CONVEX_URL.",
    });
  });
});
