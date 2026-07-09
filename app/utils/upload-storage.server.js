import crypto from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export const MAX_VIDEO_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_REQUEST_BYTES = 250 * 1024 * 1024;
export const PRODUCTION_STORAGE_ERROR = "Production file storage is not configured.";
export const STORAGE_CONFIG_ERROR = "S3-compatible file storage configuration is incomplete.";
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".m4v"]);
const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);

export function assertUploadRequestSize(request) {
  const rawContentLength = request.headers.get("content-length");
  const isMultipart = String(request.headers.get("content-type") || "")
    .toLowerCase()
    .startsWith("multipart/form-data");
  if (isMultipart && !rawContentLength) {
    throw new Response("A Content-Length header is required for file uploads.", {
      status: 411,
    });
  }
  const contentLength = Number(rawContentLength || 0);
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    throw new Response("The upload size is invalid.", { status: 400 });
  }
  if (contentLength > MAX_VIDEO_REQUEST_BYTES) {
    throw new Response("The upload is larger than the 250 MB request limit.", {
      status: 413,
    });
  }
}

export function assertUploadedVideoBatch(files = []) {
  const maxFileBytes = maxVideoFileBytes();
  const total = files.reduce((sum, file) => sum + Number(file?.size || 0), 0);
  if (total > MAX_VIDEO_REQUEST_BYTES) {
    throw new Error("Selected videos exceed the 250 MB combined upload limit.");
  }
  for (const file of files) {
    if (Number(file?.size || 0) > maxFileBytes) {
      throw new Error(
        `${file.name || "A video"} is larger than the ${formatByteLimit(maxFileBytes)} file limit.`,
      );
    }
  }
}

export async function persistUploadedVideoFile(file, { shop, namespace, storageClient } = {}) {
  if (!isFileLike(file) || !file.name || !file.size) {
    throw new Error("Choose a valid video file before uploading.");
  }
  const maxFileBytes = maxVideoFileBytes();
  if (file.size > maxFileBytes) {
    throw new Error(`Each video must be ${formatByteLimit(maxFileBytes)} or smaller.`);
  }

  const originalName = sanitizeFileName(file.name);
  const extension = path.extname(originalName).toLowerCase();
  const fileType = String(file.type || "").toLowerCase();
  if (!VIDEO_EXTENSIONS.has(extension) || !VIDEO_MIME_TYPES.has(fileType)) {
    throw new Error("Choose a valid MP4, MOV, M4V, or WebM video file.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasValidVideoSignature(bytes, extension)) {
    throw new Error("The uploaded file contents do not match a supported video format.");
  }

  const fingerprint = crypto.createHash("sha256").update(bytes).digest("hex");
  const storedFileName = `${fingerprint.slice(0, 16)}-${originalName}`;
  const safeShop = sanitizePathPart(shop || "unknown-shop");
  const safeNamespace = sanitizePathPart(namespace || "uploads");
  const objectKey = `${safeShop}/${safeNamespace}/${storedFileName}`;

  const storage = createStorageBackend({ storageClient });
  await storage.put({
    body: bytes,
    contentType: fileType,
    key: objectKey,
    metadata: { fingerprint, originalname: originalName },
  });

  return {
    originalName,
    storedFileName,
    mediaUrl: `/app/media/${encodeURIComponent(safeNamespace)}/${encodeURIComponent(storedFileName)}`,
    fileType,
    fileSize: bytes.length,
    fingerprint,
    storage: storage.name,
  };
}

export async function getPrivateMediaObject({ shop, namespace, storedFileName }) {
  const safeShop = sanitizePathPart(shop);
  const safeNamespace = sanitizePathPart(namespace);
  const safeFileName = sanitizeStoredFileName(storedFileName);

  return createStorageBackend().get({
    key: `${safeShop}/${safeNamespace}/${safeFileName}`,
    storedFileName: safeFileName,
  });
}

export async function deletePrivateMediaObjects(shop, objects = []) {
  const safeShop = sanitizePathPart(shop);
  const targets = objects
    .filter((object) => object?.storedFileName)
    .map((object) => ({
      namespace: sanitizePathPart(object.namespace || "uploads"),
      storedFileName: sanitizeStoredFileName(object.storedFileName || ""),
    }))
    .filter((object, index, records) =>
      object.storedFileName &&
      records.findIndex(
        (candidate) =>
          candidate.namespace === object.namespace &&
          candidate.storedFileName === object.storedFileName,
      ) === index,
    );

  if (!targets.length) return { deletedFiles: 0, targets: [] };

  if (storageDriver() === "s3") {
    const config = objectStorageConfig();
    await objectStorageClient(config).send(
      new DeleteObjectsCommand({
        Bucket: config.bucket,
        Delete: {
          Objects: targets.map(({ namespace, storedFileName }) => ({
            Key: `${safeShop}/${namespace}/${storedFileName}`,
          })),
          Quiet: true,
        },
      }),
    );

    return { deletedFiles: targets.length, targets };
  }

  const paths = targets.map(({ namespace, storedFileName }) =>
    path.join(localMediaRoot(), safeShop, namespace, storedFileName),
  );
  await Promise.all(paths.map((target) => rm(target, { force: true })));

  return { deletedFiles: paths.length, targets };
}

function createStorageBackend({ storageClient } = {}) {
  const driver = storageDriver();
  if (driver === "local") {
    return {
      name: "private_local_development",
      async put({ body, key }) {
        const absolutePath = path.join(localMediaRoot(), ...key.split("/"));
        await mkdir(path.dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, body, { flag: "w" });
      },
      async get({ key, storedFileName }) {
        const body = await readFile(path.join(localMediaRoot(), ...key.split("/")));
        return {
          body,
          contentLength: body.length,
          contentType: contentTypeForFile(storedFileName),
        };
      },
    };
  }

  const config = objectStorageConfig();
  const client = storageClient || objectStorageClient(config);
  return {
    name: "private_object_storage",
    async put({ body, contentType, key, metadata }) {
      try {
        await client.send(
          new PutObjectCommand({
            Body: body,
            Bucket: config.bucket,
            ContentType: contentType,
            Key: key,
            Metadata: metadata,
          }),
        );
      } catch (error) {
        throw new Error("Upload failed because private file storage is unavailable.", {
          cause: error,
        });
      }
    },
    async get({ key, storedFileName }) {
      const result = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      );
      return {
        body: result.Body?.transformToWebStream(),
        contentLength: result.ContentLength,
        contentType: result.ContentType || contentTypeForFile(storedFileName),
      };
    },
  };
}

export async function deleteUploadedWorkspaceFiles(shop) {
  const safeShop = sanitizePathPart(shop);
  let deletedFiles = 0;

  if (storageDriver() === "s3") {
    const config = objectStorageConfig();
    let continuationToken;
    do {
      const listed = await objectStorageClient(config).send(
        new ListObjectsV2Command({
          Bucket: config.bucket,
          Prefix: `${safeShop}/`,
          ContinuationToken: continuationToken,
        }),
      );
      const objects = (listed.Contents || []).flatMap(({ Key }) =>
        Key ? [{ Key }] : [],
      );
      if (objects.length) {
          await objectStorageClient(config).send(
          new DeleteObjectsCommand({
              Bucket: config.bucket,
            Delete: { Objects: objects, Quiet: true },
          }),
        );
        deletedFiles += objects.length;
      }
      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  const localTargets = [
    path.join(localMediaRoot(), safeShop),
    path.join(process.cwd(), "public", "uploads", "video-analysis", safeShop),
    path.join(process.cwd(), "public", "uploads", "creative-library", safeShop),
    path.join(process.cwd(), "build", "client", "uploads", "video-analysis", safeShop),
    path.join(process.cwd(), "build", "client", "uploads", "creative-library", safeShop),
  ];
  const localCounts = await Promise.all(localTargets.map(countFilesRecursive));
  deletedFiles += localCounts.reduce((sum, count) => sum + count, 0);
  await Promise.all(localTargets.map((target) => rm(target, { force: true, recursive: true })));

  return { deletedDirectories: localCounts.filter(Boolean).length, deletedFiles, targets: localTargets };
}

async function countFilesRecursive(target) {
  let entries;
  try {
    entries = await readdir(target, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
  const counts = await Promise.all(entries.map((entry) => {
    const next = path.join(target, entry.name);
    return entry.isDirectory() ? countFilesRecursive(next) : 1;
  }));
  return counts.reduce((sum, count) => sum + count, 0);
}

function hasValidVideoSignature(bytes, extension) {
  if (bytes.length < 12) return false;
  if (extension === ".webm") {
    return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  }
  return bytes.subarray(4, 8).toString("ascii") === "ftyp";
}

function isFileLike(file) {
  return file && typeof file.arrayBuffer === "function" && typeof file.size === "number";
}

function storageDriver() {
  const configured = String(
    process.env.FILE_STORAGE_DRIVER || process.env.STORAGE_PROVIDER || "",
  ).toLowerCase();
  const hasS3Configuration = [
    "S3_BUCKET",
    "S3_REGION",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "S3_ENDPOINT",
    "MEDIA_S3_BUCKET",
    "MEDIA_S3_REGION",
    "MEDIA_S3_ENDPOINT",
  ].some((name) => Boolean(process.env[name]));
  const driver = configured || (hasS3Configuration ? "s3" : "local");
  if (process.env.NODE_ENV === "production" && driver !== "s3") {
    throw new Error(PRODUCTION_STORAGE_ERROR);
  }
  if (driver !== "local" && driver !== "s3") {
    throw new Error("FILE_STORAGE_DRIVER must be either local or s3.");
  }
  return driver;
}

function objectStorageConfig() {
  const bucket = process.env.S3_BUCKET || process.env.MEDIA_S3_BUCKET;
  const region = process.env.S3_REGION || process.env.MEDIA_S3_REGION;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const missing = [];
  if (!bucket) missing.push("S3_BUCKET");
  if (!region) missing.push("S3_REGION");
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    missing.push(accessKeyId ? "S3_SECRET_ACCESS_KEY" : "S3_ACCESS_KEY_ID");
  }
  if (missing.length) {
    throw new Error(`${STORAGE_CONFIG_ERROR} Missing: ${missing.join(", ")}.`);
  }
  return { accessKeyId, bucket, region, secretAccessKey };
}

let s3Client;
let s3ClientKey;
function objectStorageClient(config) {
  const clientKey = JSON.stringify([
    config.bucket,
    config.region,
    config.accessKeyId || "workload-credentials",
    process.env.S3_ENDPOINT || process.env.MEDIA_S3_ENDPOINT || "",
    process.env.S3_FORCE_PATH_STYLE || process.env.MEDIA_S3_FORCE_PATH_STYLE || "",
  ]);
  if (!s3Client || s3ClientKey !== clientKey) {
    s3Client = new S3Client({
      region: config.region,
      ...(config.accessKeyId
        ? { credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } }
        : {}),
      ...(process.env.S3_ENDPOINT || process.env.MEDIA_S3_ENDPOINT
        ? {
            endpoint: process.env.S3_ENDPOINT || process.env.MEDIA_S3_ENDPOINT,
            forcePathStyle:
              (process.env.S3_FORCE_PATH_STYLE || process.env.MEDIA_S3_FORCE_PATH_STYLE) === "true",
          }
        : {}),
    });
    s3ClientKey = clientKey;
  }
  return s3Client;
}

function maxVideoFileBytes() {
  const configured = String(process.env.MAX_UPLOAD_SIZE_BYTES || "").trim();
  if (!configured) return MAX_VIDEO_FILE_BYTES;
  const parsed = Number(configured);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("MAX_UPLOAD_SIZE_BYTES must be a positive whole number of bytes.");
  }
  return parsed;
}

function formatByteLimit(bytes) {
  if (bytes % (1024 * 1024) === 0) return `${bytes / (1024 * 1024)} MB`;
  return `${bytes} bytes`;
}

function localMediaRoot() {
  return path.resolve(process.env.PRIVATE_MEDIA_ROOT || ".data/private-media");
}

function sanitizeFileName(value) {
  const parsed = path.parse(String(value || "uploaded-video.mp4"));
  const base = parsed.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "uploaded-video";
  const ext = parsed.ext.replace(/[^a-zA-Z0-9.]+/g, "").slice(0, 12).toLowerCase();
  return `${base}${ext}`;
}

function sanitizeStoredFileName(value) {
  const safe = path.basename(String(value || "")).replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe || safe !== value) throw new Error("Invalid media file name.");
  return safe;
}

function sanitizePathPart(value) {
  return String(value || "uploads").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "uploads";
}

function contentTypeForFile(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".webm") return "video/webm";
  if (extension === ".mov") return "video/quicktime";
  if (extension === ".m4v") return "video/x-m4v";
  return "video/mp4";
}
