import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { withEmbeddedRouteParams } from "../utils/embedded-routing.js";

const videoAnalysisRoute = new URL("../routes/app.video-analysis.jsx", import.meta.url);
const creativeLibraryRoute = new URL("../routes/app.creative-library.jsx", import.meta.url);

describe("saved review Creative Library routing", () => {
  it("preserves Shopify embedded context on the selected creative route", () => {
    const target = withEmbeddedRouteParams(
      "/app/creative-library?creativeId=creative-1",
      "?shop=test.myshopify.com&host=encoded-host&embedded=1&id_token=token&ignored=no",
    );

    assert.equal(
      target,
      "/app/creative-library?creativeId=creative-1&embedded=1&host=encoded-host&id_token=token&shop=test.myshopify.com",
    );
  });

  it("uses embedded internal links and never hard-codes the Render origin", async () => {
    const source = await readFile(videoAnalysisRoute, "utf8");

    assert.match(source, /to=\{withEmbeddedRouteParams\(`\/app\/creative-library\?creativeId=/);
    assert.doesNotMatch(source, /blueprintai-app\.onrender\.com/);
  });

  it("authenticates private media and falls back instead of leaving a blank player", async () => {
    const source = await readFile(creativeLibraryRoute, "utf8");
    const mediaTarget = withEmbeddedRouteParams(
      "/app/media/creative-library/abc123-TTAD2.mp4",
      "?shop=test.myshopify.com&host=encoded-host&embedded=1&id_token=token",
    );

    assert.equal(
      mediaTarget,
      "/app/media/creative-library/abc123-TTAD2.mp4?embedded=1&host=encoded-host&id_token=token&shop=test.myshopify.com",
    );

    assert.match(source, /withEmbeddedRouteParams\(resolvedCandidate, location\.search\)/);
    assert.match(source, /\[creative-library-preview\] video preview failed/);
    assert.match(source, /setPreviewFailed\(true\)/);
    assert.match(source, /Preview unavailable/);
    assert.match(source, /creative\.fileName/);
    assert.match(source, /createPortal\(/);
    assert.match(source, /overflow-x-hidden overflow-y-auto break-words/);
    assert.match(source, /grid min-w-0 grid-cols-1/);
    assert.doesNotMatch(source, /grid-cols-\[minmax\(280px/);
  });

  it("requires verified uploaded media before saving an AI Review Studio creative", async () => {
    const source = await readFile(videoAnalysisRoute, "utf8");

    assert.match(source, /resolveReviewPreviewMediaForCreative/);
    assert.match(source, /REVIEW_PREVIEW_UNAVAILABLE_MESSAGE/);
    assert.match(source, /return \{ error: REVIEW_PREVIEW_UNAVAILABLE_MESSAGE \}/);
    assert.match(source, /mediaState: "private_upload"/);
    assert.match(source, /mediaPath: previewMedia\.mediaPath/);
  });

  it("keeps current analysis separate from explicitly saved review history", async () => {
    const source = await readFile(videoAnalysisRoute, "utf8");

    assert.match(source, /getCurrentVideoAnalysis/);
    assert.match(source, /saveCurrentVideoAnalysisRecord/);
    assert.match(source, /saveCurrentVideoAnalysisAsReview/);
    assert.match(source, /clearCurrentVideoAnalysis/);
    assert.match(source, /Current analysis ready:/);
    assert.match(source, /This analysis will stay here until you save it or remove it\./);
    assert.match(source, /Remove current analysis/);
    assert.match(source, /Reviews you explicitly saved\./);
    assert.doesNotMatch(source, /auto_save_analyzed_videos/);
  });
});
