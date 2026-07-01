# Summary

BluePrintAI now uses the existing shared private-media storage abstraction with explicit `local` or `s3` driver selection, S3-compatible AWS/R2 configuration, and safe production failure behavior. Uploads are validated before persistence, provider failures cannot produce a success response, and Creative Library rejects an empty file/URL submission. Existing authenticated media delivery, CSV import, and `TTAD1.mp4`–`TTAD5.mp4` filename matching remain intact.

# Files changed

- `.env.example` — documents the canonical private storage driver, bucket, region, credentials, endpoint, and path-style variables without duplicate storage blocks.
- `README.md` — documents local private storage and AWS S3 / Cloudflare R2 production setup.
- `app/utils/upload-storage.server.js` — selects the local/S3 backend, validates configuration and files, injects credentials when supplied, and converts provider failures to safe upload errors.
- `app/utils/upload-storage.server.test.js` — covers local and mocked S3 success, validation failures, missing production configuration, provider failure, and request limits.
- `app/routes/app.creative-library.jsx` — rejects save attempts with neither an uploaded file nor a video URL.
- `CODEX_REPORT.md` — records scope, behavior, verification, and follow-ups.

# Behavior before vs after

Before, the in-progress storage helper inferred S3 solely from a bucket variable, used legacy-only variable names, emitted a different production-configuration error, and lacked complete tests for empty/unsupported/oversized files and S3 provider outcomes. Creative Library could also save a metadata-only record after an empty upload submission.

After, development defaults to private local storage while production requires the S3 driver and complete bucket/region configuration. AWS S3 and Cloudflare R2 are supported through the same private backend; credentials may be explicit or supplied by the workload. Missing configuration returns `Production file storage is not configured.`, provider failures return a safe upload error, and success is returned only after storage confirms the write. Unmatched CSV filenames remain performance-only with the existing truthful unavailable state.

# Diff overview

- Added explicit driver resolution with `FILE_STORAGE_DRIVER=local|s3`, while retaining `STORAGE_PROVIDER` and `MEDIA_S3_*` aliases for compatibility.
- Added canonical `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_FORCE_PATH_STYLE` handling.
- Kept private object keys shop- and namespace-scoped and continued serving them only through authenticated `/app/media/...` routes.
- Wrapped object-storage write failures so provider internals are not exposed and no persistence record is created after a failed write.
- Added an empty-submission guard to the Creative Library action.
- Reused the already-installed `@aws-sdk/client-s3@3.1076.0`; no dependency was added or upgraded for this change.

# Verification output

## `npm run lint`

```text
> lint
> eslint --ignore-path .gitignore --cache --cache-location ./node_modules/.cache/eslint .
```

## `npm run typecheck`

```text
> typecheck
> react-router typegen && tsc --noEmit

⚠️ Future Flag Warning: React Router emitted its existing v8 migration notices for middleware, split route modules, the Vite Environment API, pass-through requests, and trailing-slash-aware data requests.
```

Exit status: 0.

## `npm run build`

```text
> build
> react-router build

vite v6.4.3 building for production...
transforming...
✓ 2752 modules transformed.
rendering chunks...
computing gzip size...
✓ built in 2.88s

vite v6.4.3 building SSR bundle for production...
transforming...
✓ 105 modules transformed.
rendering chunks...
✓ built in 574ms
```

The build also emitted existing non-fatal React Router v8 future-flag notices, empty server-route chunk notices, and Vite dynamic/static import notices. Exit status: 0.

## `npm run test`

```text
> test
> node --experimental-specifier-resolution=node --test "app/**/*.test.js"

1..47
# tests 141
# suites 14
# pass 141
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 679.184333
```

# Tests added/changed

`app/utils/upload-storage.server.test.js` now verifies:

- private local-development persistence and authenticated-route addressing;
- empty upload rejection;
- unsupported extension/MIME rejection;
- extension-spoofed content rejection;
- per-file and multipart request size limits;
- the exact safe missing-production-configuration error;
- provider failure produces no fake success and exposes no provider details;
- mocked S3 success is returned only after the client resolves, preserving `TTAD1.mp4` and a private object key.

The existing import suite also passed, including multi-file filename matching, unsupported/duplicate/missing filename handling, two matched video persistence, and CSV-only performance import.

# What was intentionally NOT changed

- No Prisma schema or migration changes; existing `videoUrl` and payload fields continue to reference authenticated media routes.
- No authentication, billing, webhooks, App Bridge, Shopify scopes, or `shopify.app.toml` changes.
- No OAuth or advertising-platform feature work.
- No build, TypeScript, lint, or formatting configuration changes.
- No CSV parsing/import or `TTAD1.mp4`–`TTAD5.mp4` matching changes.
- No dependency additions or upgrades.
- Unrelated pre-existing worktree changes were preserved and not cleaned up.

# Open questions / follow-ups

- Production still needs a real private bucket, least-privilege credentials/workload role, lifecycle/retention policy, and deployed smoke test.
- Signed URLs are not required by the current design because media is streamed through an authenticated app route; revisit only if direct object delivery becomes necessary.
- Malware scanning, content moderation, multipart/resumable uploads, and orphan-object cleanup are separate production-hardening tasks and were intentionally left out of scope.
