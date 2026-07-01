import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  MAX_VIDEO_FILE_BYTES,
  PRODUCTION_STORAGE_ERROR,
  STORAGE_CONFIG_ERROR,
  assertUploadRequestSize,
  deleteUploadedWorkspaceFiles,
  getPrivateMediaObject,
  persistUploadedVideoFile,
} from "./upload-storage.server.js";

const shop = "private-media-test.myshopify.com";
const mp4Header = Buffer.from([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);

const storageEnvNames = [
  "FILE_STORAGE_DRIVER",
  "STORAGE_PROVIDER",
  "S3_BUCKET",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_ENDPOINT",
  "MEDIA_S3_BUCKET",
  "MEDIA_S3_REGION",
  "MAX_UPLOAD_SIZE_BYTES",
  "NODE_ENV",
];

async function withStorageEnv(values, callback) {
  const previous = Object.fromEntries(storageEnvNames.map((name) => [name, process.env[name]]));
  for (const name of storageEnvNames) delete process.env[name];
  Object.assign(process.env, values);
  try {
    return await callback();
  } finally {
    for (const name of storageEnvNames) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

test("stores development media privately and serves it through an authenticated route path", async () => {
  const stored = await persistUploadedVideoFile(
    new File([mp4Header, "video"], "clip.mp4", { type: "video/mp4" }),
    { namespace: "creative-library", shop },
  );
  assert.match(stored.mediaUrl, /^\/app\/media\/creative-library\//);
  assert.equal(stored.storage, "private_local_development");
  const media = await getPrivateMediaObject({
    shop,
    namespace: "creative-library",
    storedFileName: stored.storedFileName,
  });
  assert.equal(media.contentType, "video/mp4");
  assert.ok(media.contentLength > mp4Header.length);
  await assert.rejects(
    readFile(path.resolve("public", "uploads", "creative-library", shop, stored.storedFileName)),
    { code: "ENOENT" },
  );
  const deleted = await deleteUploadedWorkspaceFiles(shop);
  assert.equal(deleted.deletedFiles, 1);
});

test("rejects extension-spoofed video content", async () => {
  await assert.rejects(
    persistUploadedVideoFile(
      new File(["not a video"], "fake.mp4", { type: "video/mp4" }),
      { namespace: "video-analysis", shop },
    ),
    /contents do not match/,
  );
  await rm(path.resolve(".data", "private-media", shop), { force: true, recursive: true });
});

test("rejects empty, unsupported, and oversized video uploads", async () => {
  await assert.rejects(
    persistUploadedVideoFile(null, { namespace: "video-analysis", shop }),
    /Choose a valid video file/,
  );
  await assert.rejects(
    persistUploadedVideoFile(
      new File(["plain text"], "notes.txt", { type: "text/plain" }),
      { namespace: "video-analysis", shop },
    ),
    /valid MP4, MOV, M4V, or WebM/,
  );
  await assert.rejects(
    persistUploadedVideoFile(
      {
        arrayBuffer: async () => new ArrayBuffer(0),
        name: "large.mp4",
        size: MAX_VIDEO_FILE_BYTES + 1,
        type: "video/mp4",
      },
      { namespace: "video-analysis", shop },
    ),
    /100 MB or smaller/,
  );
});

test("fails safely when production does not select object storage", async () => {
  await withStorageEnv({ NODE_ENV: "production" }, async () => {
    await assert.rejects(
      persistUploadedVideoFile(
        new File([mp4Header, "video"], "clip.mp4", { type: "video/mp4" }),
        { namespace: "creative-library", shop },
      ),
      (error) => error.message === PRODUCTION_STORAGE_ERROR,
    );
  });
});

test("fails clearly when selected object storage is partially configured", async () => {
  await withStorageEnv(
    { S3_ACCESS_KEY_ID: "partial-key" },
    async () => {
      await assert.rejects(
        persistUploadedVideoFile(
          new File([mp4Header, "video"], "clip.mp4", { type: "video/mp4" }),
          { namespace: "creative-library", shop },
        ),
        (error) =>
          error.message.startsWith(STORAGE_CONFIG_ERROR) &&
          error.message.includes("S3_BUCKET") &&
          error.message.includes("S3_SECRET_ACCESS_KEY"),
      );
    },
  );
});

test("enforces a valid configurable per-file upload limit", async () => {
  await withStorageEnv({ MAX_UPLOAD_SIZE_BYTES: "12" }, async () => {
    await assert.rejects(
      persistUploadedVideoFile(
        new File([mp4Header, "x"], "clip.mp4", { type: "video/mp4" }),
        { namespace: "creative-library", shop },
      ),
      /12 bytes or smaller/,
    );
  });
  await withStorageEnv({ MAX_UPLOAD_SIZE_BYTES: "not-a-number" }, async () => {
    await assert.rejects(
      persistUploadedVideoFile(
        new File([mp4Header], "clip.mp4", { type: "video/mp4" }),
        { namespace: "creative-library", shop },
      ),
      /must be a positive whole number/,
    );
  });
});

test("does not report success when the object storage provider fails", async () => {
  await withStorageEnv(
    {
      FILE_STORAGE_DRIVER: "s3",
      S3_BUCKET: "private-test-bucket",
      S3_REGION: "us-east-1",
    },
    async () => {
      await assert.rejects(
        persistUploadedVideoFile(
          new File([mp4Header, "video"], "clip.mp4", { type: "video/mp4" }),
          {
            namespace: "creative-library",
            shop,
            storageClient: { send: async () => { throw new Error("provider details"); } },
          },
        ),
        /Upload failed because private file storage is unavailable/,
      );
    },
  );
});

test("reports success only after the object storage provider confirms the upload", async () => {
  let storedCommand;
  await withStorageEnv(
    {
      FILE_STORAGE_DRIVER: "s3",
      S3_BUCKET: "private-test-bucket",
      S3_REGION: "us-east-1",
    },
    async () => {
      const stored = await persistUploadedVideoFile(
        new File([mp4Header, "video"], "TTAD1.mp4", { type: "video/mp4" }),
        {
          namespace: "creative-library",
          shop,
          storageClient: { send: async (command) => { storedCommand = command; return {}; } },
        },
      );
      assert.equal(stored.storage, "private_object_storage");
      assert.equal(stored.originalName, "TTAD1.mp4");
      assert.equal(storedCommand.input.Bucket, "private-test-bucket");
      assert.match(storedCommand.input.Key, /creative-library\/.*-TTAD1\.mp4$/);
    },
  );
});

test("rejects chunked or oversized multipart bodies before form parsing", () => {
  assert.throws(
    () =>
      assertUploadRequestSize(
        new Request("https://blueprintai.app/app/data-import", {
          headers: { "content-type": "multipart/form-data; boundary=test" },
          method: "POST",
        }),
      ),
    (error) => error instanceof Response && error.status === 411,
  );
  assert.throws(
    () =>
      assertUploadRequestSize(
        new Request("https://blueprintai.app/app/data-import", {
          headers: {
            "content-length": String(251 * 1024 * 1024),
            "content-type": "multipart/form-data; boundary=test",
          },
          method: "POST",
        }),
      ),
    (error) => error instanceof Response && error.status === 413,
  );
});
