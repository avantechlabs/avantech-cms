const productionMessage =
  "Production builds must use PROD_CMS_CONVEX_URL for VITE_CONVEX_URL.";
const missingMessage =
  "Production builds require VITE_CONVEX_URL and PROD_CMS_CONVEX_URL.";

function normalizeUrl(value) {
  return value?.trim().replace(/\/+$/, "");
}

export function checkProdEnv(env = process.env) {
  const isProduction =
    env.VERCEL_ENV === "production" || env.NODE_ENV === "production";

  if (!isProduction) {
    return { ok: true };
  }

  const siteConvexUrl = normalizeUrl(env.VITE_CONVEX_URL);
  const productionConvexUrl = normalizeUrl(env.PROD_CMS_CONVEX_URL);

  if (!siteConvexUrl || !productionConvexUrl) {
    return { ok: false, message: missingMessage };
  }

  if (siteConvexUrl !== productionConvexUrl) {
    return { ok: false, message: productionMessage };
  }

  return { ok: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = checkProdEnv();

  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }
}
