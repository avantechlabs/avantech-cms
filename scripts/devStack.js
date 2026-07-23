import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const projectsRoot = resolve(repoRoot, "../projects");
function readDotEnv(filePath) {
  if (!existsSync(filePath)) return {};

  const entries = {};
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*([^#\n]+)\s*(?:#.*)?$/);
    if (!match) continue;
    entries[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return entries;
}

function devCmsUrl(env = process.env) {
  const localEnv = readDotEnv(resolve(repoRoot, ".env.local"));
  return env.DEV_CMS_CONVEX_URL ?? env.VITE_CONVEX_URL ?? localEnv.VITE_CONVEX_URL;
}

function localUrl(port) {
  return `http://localhost:${port}`;
}

function viteProcess(name, cwd, port, env = {}) {
  return {
    name,
    cwd,
    port,
    url: localUrl(port),
    command: "pnpm",
    args: ["exec", "vite", "--host", "0.0.0.0", "--port", String(port), "--strictPort"],
    env,
  };
}

export function createDevStackProcesses(env = process.env) {
  const cmsUrl = devCmsUrl(env);
  if (!cmsUrl) {
    throw new Error("Set VITE_CONVEX_URL or DEV_CMS_CONVEX_URL before running pnpm dev.");
  }

  return [
    viteProcess("cms", repoRoot, 51730),
    viteProcess("site-demo", resolve(repoRoot, "examples/site-demo"), 51731, {
      VITE_CONVEX_URL: cmsUrl,
    }),
    viteProcess("sable", resolve(repoRoot, "examples/sable"), 51732, {
      VITE_CONVEX_URL: cmsUrl,
    }),
    viteProcess("endocafe", resolve(projectsRoot, "endocafe"), 51741, {
      VITE_CONVEX_URL: cmsUrl,
    }),
    viteProcess("cleaning", resolve(projectsRoot, "cleaning"), 51742, {
      VITE_CONVEX_URL: cmsUrl,
    }),
    viteProcess("servir-avec-compassion", resolve(projectsRoot, "servir-avec-compassion"), 51743, {
      VITE_CONVEX_URL: cmsUrl,
    }),
    {
      name: "directive-films",
    cwd: resolve(projectsRoot, "directive-films"),
    port: 51744,
    url: localUrl(51744),
      command: "pnpm",
      args: [
        "exec",
        "react-router",
        "dev",
        "--host",
        "0.0.0.0",
        "--port",
        "51744",
        "--strictPort",
      ],
      env: {
        VITE_CONVEX_URL: cmsUrl,
      },
    },
  ];
}

function startProcess(config) {
  const child = spawn(config.command, config.args, {
    cwd: config.cwd,
    env: { ...process.env, ...config.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const prefix = `[${config.name}]`;
  child.stdout.on("data", (chunk) => process.stdout.write(`${prefix} ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`${prefix} ${chunk}`));
  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`${prefix} stopped by ${signal}`);
      return;
    }
    if (code !== 0) {
      console.error(`${prefix} exited with code ${code}`);
      process.exitCode = code ?? 1;
    }
  });

  return child;
}

function stopAll(children) {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const devStackProcesses = createDevStackProcesses();

  console.log("Starting CMS dev stack:");
  for (const config of devStackProcesses) {
    console.log(`- ${config.name}: ${config.url}`);
  }

  const children = devStackProcesses.map(startProcess);
  process.on("SIGINT", () => {
    stopAll(children);
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    stopAll(children);
    process.exit(143);
  });
}
