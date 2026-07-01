import { mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import db from "../app/db.server.js";

const publicRoot = path.resolve("public", "uploads");
const privateRoot = path.resolve(process.env.PRIVATE_MEDIA_ROOT || ".data/private-media");
const namespaces = ["video-analysis", "creative-library"];
const replacements = new Map();

for (const namespace of namespaces) {
  const namespaceRoot = path.join(publicRoot, namespace);
  for (const shopEntry of await safeReadDir(namespaceRoot)) {
    if (!shopEntry.isDirectory()) continue;
    const sourceShopDir = path.join(namespaceRoot, shopEntry.name);
    const targetShopDir = path.join(privateRoot, shopEntry.name, namespace);
    await mkdir(targetShopDir, { recursive: true });
    for (const fileEntry of await safeReadDir(sourceShopDir)) {
      if (!fileEntry.isFile()) continue;
      const source = path.join(sourceShopDir, fileEntry.name);
      const target = path.join(targetShopDir, fileEntry.name);
      await rename(source, target);
      replacements.set(
        `/uploads/${namespace}/${shopEntry.name}/${fileEntry.name}`,
        `/app/media/${namespace}/${fileEntry.name}`,
      );
    }
    await rm(sourceShopDir, { force: true, recursive: true });
  }
}

if (replacements.size) {
  const [performance, creatives, analyses] = await Promise.all([
    db.creativePerformance.findMany(),
    db.savedCreative.findMany(),
    db.videoAnalysis.findMany(),
  ]);
  await db.$transaction([
    ...performance.flatMap((record) => {
      const data = {
        videoUrl: replaceUrls(record.videoUrl),
        assetUrl: replaceUrls(record.assetUrl),
        sourceUrl: replaceUrls(record.sourceUrl),
        payloadJson: replaceUrls(record.payloadJson),
      };
      return Object.values(data).some((value, index) => value !== [record.videoUrl, record.assetUrl, record.sourceUrl, record.payloadJson][index])
        ? [db.creativePerformance.update({ where: { id: record.id }, data })]
        : [];
    }),
    ...creatives.flatMap((record) => {
      const payloadJson = replaceUrls(record.payloadJson);
      return payloadJson !== record.payloadJson
        ? [db.savedCreative.update({ where: { id: record.id }, data: { payloadJson } })]
        : [];
    }),
    ...analyses.flatMap((record) => {
      const payloadJson = replaceUrls(record.payloadJson);
      return payloadJson !== record.payloadJson
        ? [db.videoAnalysis.update({ where: { id: record.id }, data: { payloadJson } })]
        : [];
    }),
  ]);
}

await rm(publicRoot, { force: true, recursive: true });
console.info(`Moved ${replacements.size} legacy public media files into private storage.`);

function replaceUrls(value) {
  if (typeof value !== "string") return value;
  let next = value;
  for (const [from, to] of replacements) next = next.split(from).join(to);
  return next;
}

async function safeReadDir(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
