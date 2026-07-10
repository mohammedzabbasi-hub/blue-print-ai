import assert from "node:assert/strict";
import test from "node:test";

import { normalizeExternalVideoUrl } from "./media-urls.js";

test("external video URLs require credential-free HTTPS and a supported extension", () => {
  assert.equal(
    normalizeExternalVideoUrl("https://cdn.example.com/path/video.mp4?token=public"),
    "https://cdn.example.com/path/video.mp4?token=public",
  );
  for (const unsafe of [
    "javascript:alert(1).mp4",
    "http://cdn.example.com/video.mp4",
    "https://user:pass@cdn.example.com/video.mp4",
    "https://cdn.example.com/video.txt",
    "//cdn.example.com/video.mp4",
  ]) {
    assert.equal(normalizeExternalVideoUrl(unsafe), "", unsafe);
  }
});
