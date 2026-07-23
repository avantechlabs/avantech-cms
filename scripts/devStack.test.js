// @vitest-environment node
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { createDevStackProcesses } from "./devStack.js";

const cmsUrl = "https://dev-cms.example.com";
const devStackProcesses = createDevStackProcesses({ VITE_CONVEX_URL: cmsUrl });

describe("dev stack process config", () => {
  test("starts CMS and every known public site on fixed local ports", () => {
    expect(
      devStackProcesses.map((process) => ({
        name: process.name,
        port: process.port,
        url: process.url,
      })),
    ).toEqual([
      { name: "cms", port: 51730, url: "http://localhost:51730" },
      { name: "site-demo", port: 51731, url: "http://localhost:51731" },
      { name: "sable", port: 51732, url: "http://localhost:51732" },
      { name: "endocafe", port: 51741, url: "http://localhost:51741" },
      { name: "cleaning", port: 51742, url: "http://localhost:51742" },
      {
        name: "servir-avec-compassion",
        port: 51743,
        url: "http://localhost:51743",
      },
      { name: "directive-films", port: 51744, url: "http://localhost:51744" },
    ]);
  });

  test("uses strict ports so the editor URL never drifts", () => {
    for (const process of devStackProcesses) {
      expect(process.args).toContain(String(process.port));
      expect(process.args).toContain("--strictPort");
    }
  });

  test("keeps all public sites on the dev CMS deployment", () => {
    for (const process of devStackProcesses.filter((item) => item.name !== "cms")) {
      expect(process.env).toMatchObject({
        VITE_CONVEX_URL: cmsUrl,
      });
    }
  });

  test("repo-local example dev scripts use the same fixed ports", () => {
    for (const process of devStackProcesses.filter((item) =>
      ["site-demo", "sable"].includes(item.name),
    )) {
      const packageJson = JSON.parse(readFileSync(`${process.cwd}/package.json`, "utf8"));
      expect(packageJson.scripts.dev).toContain(String(process.port));
    }
  });
});
