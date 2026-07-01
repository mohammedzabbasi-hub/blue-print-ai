# Production Creative/Video Storage Report

## Summary

BluePrintAI creative/video uploads now pass through one private storage module with local-filesystem and S3-compatible backends. Local development needs no credentials. Production uses private AWS S3 or Cloudflare R2 storage, rejects incomplete configuration, validates uploads before persistence, and reports actual failures instead of claiming success.

## Current behavior found

At inspection time, `app/routes/app.data-import.jsx` received multipart CSV/video uploads and delegated to `getUploadedVideoFiles`, `buildCreativeUploadPreview`, and `importMatchedCreativeRows` in `app/models/creative-upload-import.server.js`. `buildUploadedVideoIndex` and `decorateCreativeUploadRow` matched CSV filename aliases case-insensitively by trimmed base filename. `importMatchedCreativeRows` stored a matched file before calling `upsertPublicEngagementRecord`; its authenticated media URL and original-name/fingerprint metadata were persisted in `CreativePerformance`/`SavedCreative` payload data. AI Review Studio and direct Creative Library uploads likewise called `persistUploadedVideoFile` before creating records.

The working tree already had private local storage under `.data/private-media`, authenticated reads through `app/routes/app.media.$namespace.$filename.jsx`, and an S3 path, but its backend boundary was implicit. The upload cap was fixed, some partial S3 configurations could select local storage outside production, and configuration errors did not name missing values. The Prisma models store URLs and JSON payload metadata rather than file bytes.

## Storage abstraction

`app/utils/upload-storage.server.js` is the single write/read boundary. `createStorageBackend` selects a minimal backend exposing `put` and `get`; the domain functions `persistUploadedVideoFile` and `getPrivateMediaObject` validate and normalize creative/video data around that interface. Workspace deletion also goes through this module.

Stored object keys remain `<sanitized-shop>/<namespace>/<sha256-prefix>-<sanitized-original-filename>`. The content hash gives deterministic collision behavior while retaining `TTAD1.mp4`-style names for metadata and CSV matching.

## Local vs. production

With storage variables unset, development uses `.data/private-media` and authenticated `/app/media/...` responses. In `NODE_ENV=production`, local storage is refused. Set `FILE_STORAGE_DRIVER=s3`, `S3_BUCKET`, and `S3_REGION` for AWS S3. Add `S3_ENDPOINT` for R2 or another compatible provider and `S3_FORCE_PATH_STYLE=true` only if required. Credentials may be the paired access-key variables or the host's AWS-compatible workload credentials.

Any detected but incomplete S3 configuration throws a message listing missing variables; it does not fall back to disk.

## Dependency status

`@aws-sdk/client-s3` was already present when inspected, so the production backend uses `S3Client`, `PutObjectCommand`, `GetObjectCommand`, `ListObjectsV2Command`, and `DeleteObjectsCommand`. No additional package was needed for this task.

## Validation

Allowed formats are unchanged: MP4, MOV, M4V, and WebM. Validation requires a supported extension and MIME type, a matching MP4-family `ftyp` or WebM EBML signature, a non-empty file, and a file size at or below `MAX_UPLOAD_SIZE_BYTES` (100 MB by default). Multipart requests retain the 250 MB request/batch ceiling and require `Content-Length` before form parsing.

Invalid `MAX_UPLOAD_SIZE_BYTES`, zero-byte uploads, unsupported/spoofed content, oversized individual files, and oversized batches return explicit errors.

## Error handling

S3 `PutObject` must resolve before upload success metadata is returned. Provider failures become a clear private-storage-unavailable upload error. Data Import catches the error on the affected row and does not call the DB upsert for that row; AI Review Studio and Creative Library actions return their existing merchant-visible error state. Missing media is converted to a controlled authenticated 404 by the media route.

## CSV matching

Matching remains based on a normalized base filename before storage. A focused test now verifies exact matches for `TTAD1.mp4`, `TTAD2.mp4`, `TTAD3.mp4`, `TTAD4.mp4`, and `TTAD5.mp4`. Duplicate names remain ambiguous rather than silently overwriting a match; paths are rejected; spaces/special characters are normalized consistently only after matching.

## Environment/configuration

Safe examples are documented in `.env.example`:

- `FILE_STORAGE_DRIVER=local`
- `MAX_UPLOAD_SIZE_BYTES=104857600`
- `S3_BUCKET=`
- `S3_REGION=us-east-1`
- `S3_ACCESS_KEY_ID=`
- `S3_SECRET_ACCESS_KEY=`
- `S3_ENDPOINT=`
- `S3_FORCE_PATH_STYLE=false`

## Files changed

The storage implementation and integration are contained in:

- `.gitignore`
- `.env.example`
- `README.md`
- `package.json`
- `package-lock.json`
- `app/utils/upload-storage.server.js`
- `app/utils/upload-storage.server.test.js`
- `app/routes/app.media.$namespace.$filename.jsx`
- `app/routes/app.data-import.jsx`
- `app/routes/app.video-analysis.jsx`
- `app/routes/app.creative-library.jsx`
- `app/models/creative-upload-import.server.js`
- `app/models/creative-upload-import.server.test.js`
- `app/models/blueprint.server.js`
- `STORAGE_PRODUCTION_REPORT.md`

The repository had substantial unrelated pre-existing worktree changes; they were preserved and are not attributed to this storage task.

## Prisma

No Prisma schema change was required for file storage. The existing worktree's unrelated Prisma changes were left untouched.

## Tests

Storage tests cover private local writes/reads, format/signature rejection, empty and oversized uploads, configurable limits, invalid configuration, production local-driver refusal, provider failure without fake success, mocked S3 success, authenticated media paths, and pre-parse request limits. Import tests cover multi-file persistence and exact TTAD1-through-TTAD5 filename matching.

## Verification results

- `npm run lint`: PASS
- `npm run typecheck`: PASS (React Router future-flag warnings only)
- `npm run build`: PASS (React Router future-flag warnings only)
- `npm run test`: PASS — 144 tests, 0 failures

## Restrictions honored

No OAuth, Shopify authentication, Shopify scopes, or billing changes were made for this task. No credentials were added. The Prisma schema was not changed for storage. The upload UI was not redesigned; existing error surfaces were reused. CSV matching semantics were preserved.

## Follow-ups / risks

Before production deployment, the operator must create a private S3/R2 bucket, grant least-privilege object read/write/list/delete access, set the production environment variables in the host's secret/config manager, and verify upload/read/delete behavior against that real provider. Bucket objects must remain private because access is mediated by the authenticated app route. Existing files on a legacy local/public path should be migrated with the repository's media migration workflow before an ephemeral deployment is retired.
