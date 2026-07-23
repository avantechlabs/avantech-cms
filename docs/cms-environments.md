# CMS Environments

Public sites read CMS content from Convex.

Use different Convex deployments for local work and production.

Each CMS site stores one `siteUrl`.
That value changes by CMS deployment.

- Dev CMS: `siteUrl` is usually localhost.
- Production CMS: `siteUrl` is the live website URL.

## Local CMS

The CMS app uses the dev Convex deployment.

```env
CONVEX_DEPLOYMENT=dev:healthy-fox-966
VITE_CONVEX_URL=https://healthy-fox-966.convex.cloud
VITE_CONVEX_SITE_URL=https://healthy-fox-966.convex.site
```

## Local Public Sites

Local public sites also use the dev CMS deployment.

```env
VITE_CONVEX_URL=https://healthy-fox-966.convex.cloud
```

Run the full local stack from this repo:

```bash
pnpm dev
```

Local ports:

| Site | Local URL |
| --- | --- |
| CMS | `http://localhost:51730` |
| site-demo | `http://localhost:51731` |
| sable | `http://localhost:51732` |
| endocafe | `http://localhost:51741` |
| cleaning | `http://localhost:51742` |
| servir-avec-compassion | `http://localhost:51743` |
| directive-films | `http://localhost:51744` |

In the dev CMS, use these same URLs as each site's `siteUrl`.

## Production Public Sites

Production public sites must use the production CMS deployment.

```env
VITE_CONVEX_URL=https://shocking-boar-256.convex.cloud
PROD_CMS_CONVEX_URL=https://shocking-boar-256.convex.cloud
```

`PROD_CMS_CONVEX_URL` is the expected production CMS URL.
The guard compares it to `VITE_CONVEX_URL`.

If they do not match, the production build fails.

In the production CMS, each site's `siteUrl` should be its live website URL.

## Vercel Production Deploys

Vercel auto-deploys pushes to `main` through its Git integration.

The Vercel build command is defined in `vercel.json`:

```bash
pnpm test && pnpm run build
```

`pnpm run build` runs `pnpm run check:prod-env` first through `prebuild`, so a
production deployment fails before build output is created when
`VITE_CONVEX_URL` does not match `PROD_CMS_CONVEX_URL`.

Set these Vercel Production environment variables:

```env
VITE_CONVEX_URL=https://shocking-boar-256.convex.cloud
PROD_CMS_CONVEX_URL=https://shocking-boar-256.convex.cloud
```

GitHub Actions does not deploy to Vercel. It runs the same test and build
checks so pushed commits fail visibly in GitHub when the production CMS
configuration is wrong.

## Convex Deploy

When deploying CMS backend functions to production, use the production deploy key.

```env
CONVEX_DEPLOY_KEY=<production Convex deploy key>
```

Keep this value secret.
Set it in GitHub or Vercel secrets.

## Safety Check

Run this before production deploys:

```bash
pnpm run check:prod-env
```

CI and Vercel both run the same check with production env values.
