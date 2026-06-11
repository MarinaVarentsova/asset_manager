---
name: Vercel deploy of this pnpm monorepo
description: How the cert-uploader frontend + Express upload route deploy to Vercel from GitHub, and the routing gotcha that bit us.
---

# Deploying this monorepo to Vercel (GitHub import)

This repo deploys to Vercel as: Vite SPA frontend (`@workspace/cert-uploader`) served
statically + the Express upload route reused as a single serverless function under `/api`.
Replit (workflows + `artifacts/api-server`) is left fully working in parallel — all Vercel
changes are additive.

## Key files
- `vercel.json` (repo root): `framework:null`, `buildCommand: pnpm run vercel-build`,
  `outputDirectory: artifacts/cert-uploader/dist/public`. **No rewrites.**
- Root `package.json`: `vercel-build` script (builds only cert-uploader),
  `packageManager: pnpm@<ver>`, and runtime deps (express/multer/xlsx/@supabase/supabase-js)
  so the function can bundle.
- `api/[...path].ts`: catch-all serverless function. Imports the existing upload router
  (`../artifacts/api-server/src/routes/upload`) — validation/Supabase logic is reused, never
  duplicated. Installs a `req.log` console shim (no pino on Vercel).

## Routing gotcha (why catch-all, not a rewrite)
A `vercel.json` rewrite of `"/api/(.*)" -> "/api"` **drops the path suffix** — the function
sees `req.url = /api`, so `/api/upload` never reaches `POST /upload`.
**Fix:** use a catch-all file `api/[...path].ts`. Vercel filesystem-routes every `/api/*`
request to it with the *full original path preserved* (`/api/upload`), so Express mounted at
`/api` matches. No rewrite needed.
**Why:** Vercel rewrite destinations replace the URL the function receives unless you use a
capture-preserving destination; the catch-all filename avoids the whole class of bug.

## Limits / verify
- Vercel serverless request-body cap (~4.5MB Hobby) is **below** multer's 20MB limit — large
  uploads get a platform 413 before reaching Express. Registry files are tiny, so fine; just
  know the cap is the platform's, not the app's.
- Verify the function bundles before deploying: esbuild-bundle `api/[...path].ts`
  (platform node, format cjs, bundle:true). The upload route has no `@workspace/*` imports,
  so libs need not be built for the function.
- `vite.config.ts` no longer throws when `PORT`/`BASE_PATH` are unset (Vercel build has
  neither); `base` defaults to `/`. Replit workflow still sets both, so unchanged there.
