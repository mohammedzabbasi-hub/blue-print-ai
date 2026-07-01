# Analyzer Production Safety Report

## Investigation and data flow

Inspected `app/routes/app.video-analysis.jsx`, `app/services/media-analyzer.server.js`, `app/services/media_analyzer_bridge.py`, `app/utils/video-analysis-evidence.js`, `app/utils/upload-storage.server.js`, the video-analysis persistence functions in `app/models/blueprint.server.js`, analyzer/evidence/storage tests, `.env.example`, and `README.md`. Repository-wide analyzer, retention, score, drop-off, and heuristic references were also searched.

The unchanged upload flow accepts multipart field `file`, validates request and video limits/signatures, and stores the bytes through `persistUploadedVideoFile` in private local development storage or configured S3-compatible production storage. After storage succeeds, `analyzeUploadedVideoFile` checks runtime configuration and, only when fully configured, sends the original video as multipart field `file` to `ANALYZER_SERVICE_URL` with `Authorization: Bearer <ANALYZER_API_KEY>`. The response is parsed as JSON, normalized without adding analyzer fields, optionally persisted as the shop-scoped analysis record, and rendered by the route.

## Unsafe values found and fixed

- Missing hook, CTA, and clarity scores were previously filled by `analyzeVideoInput`; that fallback was removed.
- Missing summary, creator style, strengths, weaknesses, recommendations, pacing notes, and first-ten-second risk were synthesized locally; those defaults were removed from analyzer results.
- The UI derived readiness, pattern matches, classifications, score-based conclusions, ad rewrites, and a fixed next-test plan. These invented conclusions were removed.
- Missing scores and metadata were coerced to zero, `?`, `Unknown`, or an em dash. Analyzer metrics now use the exact string `Not available`.
- Saved-review overall score was calculated by averaging other scores and CTA prose was synthesized from the score. Both derivations were removed.
- The Python bridge returned fixed 4/10 scores when media was unreadable. It now returns an error with no analysis object. Its heuristic output declares `analysis_method: heuristic`; it is no longer invoked by the production service client.
- Legacy fabricated retention defaults are suppressed by `normalizeRetentionAnalysis`; missing retention stays unavailable and no curve/drop-off claim is created.

## Runtime states

- **Disabled:** false or unset `ANALYZER_ENABLED` reports “Analyzer unavailable in this environment.” No analyzer request or result rendering occurs.
- **Missing/invalid config:** missing service URL/key or an invalid URL is treated as unavailable with no analyzer request.
- **Failure:** network errors, non-2xx responses, analyzer error/fallback responses, and malformed JSON return a safe failure object containing no analysis.
- **Timeout:** an `AbortController` enforces the whole-request deadline. Timeout is a safe failure with no result.
- **Partial:** response fields are copied only when present. Missing UI metrics display `Not available`.
- **Success:** the analyzer response's analysis, metadata, transcript, OCR, and retention values are preserved; no missing analyzer value is guessed.
- **Estimated/heuristic:** analyzer output declared heuristic, estimated, predicted, or modeled is labeled `Estimated` in score and retention UI.

## Configuration

- `ANALYZER_ENABLED`: must be exactly `true` (case-insensitive after string conversion).
- `ANALYZER_SERVICE_URL`: required HTTP(S) endpoint.
- `ANALYZER_API_KEY`: required server-side Bearer credential.
- `ANALYZER_TIMEOUT_MS`: complete request timeout; defaults to 60,000 ms and is capped at 600,000 ms.

Safe examples and comments are in `.env.example`; deployment behavior is documented in `README.md`.

## Tests and verification

Tests cover disabled configuration, missing URL/key, successful output preservation, non-2xx failure, malformed response, timeout abort, partial output without synthesized fields, unavailable retention, legacy fabricated retention suppression, and heuristic evidence labeling.

- `npm run lint`: passed.
- `npm run typecheck`: passed (React Router future-flag warnings only).
- `npm run build`: passed (existing Vite chunking/future-flag warnings only).
- `npm test`: passed, 148 tests.

Upload validation and private persistence behavior were not changed. Real analyzer values continue through the same storage/display shape. No OAuth, Shopify auth/scope/billing/webhook, unrelated page, or broad AI feature changes were made. No live external analyzer was available in this workspace, so transport behavior was verified with deterministic HTTP mocks rather than an end-to-end production service call.
