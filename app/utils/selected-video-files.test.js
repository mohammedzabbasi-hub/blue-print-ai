import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendSelectedVideoFiles,
  buildCreativeImportFormData,
  CREATIVE_VIDEO_FILE_FIELD,
  removeSelectedVideoFile,
} from "./selected-video-files.js";

describe("selected video file queue", () => {
  it("accumulates files selected in separate picker actions", () => {
    const first = appendSelectedVideoFiles([], [videoFile("TTAD1.mp4", "one", 1)]);
    const second = appendSelectedVideoFiles(first, [videoFile("TTAD2.mp4", "two", 2)]);

    assert.deepEqual(second.map((file) => file.name), ["TTAD1.mp4", "TTAD2.mp4"]);
  });

  it("keeps select-many-at-once behavior", () => {
    const selected = appendSelectedVideoFiles([], [
      videoFile("TTAD1.mp4", "one", 1),
      videoFile("TTAD2.mp4", "two", 2),
    ]);

    assert.equal(selected.length, 2);
  });

  it("deduplicates by normalized filename, size, and lastModified", () => {
    const original = videoFile("TTAD1.mp4", "same", 10);
    const duplicate = videoFile(" ttad1.MP4 ", "same", 10);
    const differentRevision = videoFile("TTAD1.mp4", "new-size", 10);
    const selected = appendSelectedVideoFiles([original], [duplicate, differentRevision]);

    assert.equal(selected.length, 2);
    assert.equal(selected[0], original);
    assert.equal(selected[1], differentRevision);
  });

  it("removes one file while keeping the others", () => {
    const first = videoFile("TTAD1.mp4", "one", 1);
    const second = videoFile("TTAD2.mp4", "two", 2);
    const remaining = removeSelectedVideoFile([first, second], first);

    assert.deepEqual(remaining.map((file) => file.name), ["TTAD2.mp4"]);
  });

  it("supports clearing selected file state", () => {
    const selected = appendSelectedVideoFiles([], [videoFile("TTAD1.mp4", "one", 1)]);
    const cleared = [];

    assert.equal(selected.length, 1);
    assert.deepEqual(cleared, []);
  });

  it("manually appends every accumulated file to multipart FormData", () => {
    const selectedVideos = [
      videoFile("TTAD1.mp4", "one", 1),
      videoFile("TTAD2.mp4", "two", 2),
    ];
    const formData = buildCreativeImportFormData({
      csvText: "video_filename\nTTAD1.mp4",
      intent: "creative-upload-preview",
      selectedVideos,
    });

    assert.equal(CREATIVE_VIDEO_FILE_FIELD, "videoFiles");
    assert.equal(formData.get("intent"), "creative-upload-preview");
    assert.deepEqual(
      formData.getAll(CREATIVE_VIDEO_FILE_FIELD).map((file) => file.name),
      ["TTAD1.mp4", "TTAD2.mp4"],
    );
  });
});

function videoFile(name, contents, lastModified) {
  return new File([contents], name, { lastModified, type: "video/mp4" });
}
