import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ANALYZER_SCRIPT = path.resolve("app/services/media_analyzer_bridge.py");
const MAX_ANALYZER_BYTES = 250 * 1024 * 1024;

export async function analyzeUploadedVideoFile(videoFile) {
  if (!videoFile || typeof videoFile.arrayBuffer !== "function" || !videoFile.size) {
    return {
      available: false,
      message: "No uploaded media file was available for frame, audio, and OCR analysis.",
    };
  }

  if (!String(videoFile.type || "").startsWith("video/")) {
    return {
      available: false,
      message: "Frame, audio, and OCR analysis only runs for uploaded video files.",
    };
  }

  if (videoFile.size > MAX_ANALYZER_BYTES) {
    return {
      available: false,
      message: "The uploaded video is too large for local frame, audio, and OCR analysis.",
    };
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "blueprintai-video-"));
  const safeName = sanitizeFileName(videoFile.name || "upload.mp4");
  const videoPath = path.join(tempDir, safeName);

  try {
    await writeFile(videoPath, Buffer.from(await videoFile.arrayBuffer()));
    const result = await runPythonAnalyzer(videoPath, tempDir);

    return {
      available: true,
      ...result,
    };
  } catch (error) {
    return {
      available: false,
      message: `Frame, audio, and OCR analysis was unavailable: ${error.message}`,
    };
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function runPythonAnalyzer(videoPath, workDir) {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [ANALYZER_SCRIPT, videoPath, workDir], {
      cwd: path.resolve("."),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Analyzer exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Analyzer returned invalid JSON: ${error.message}`));
      }
    });
  });
}

function sanitizeFileName(value) {
  const fallback = "upload.mp4";
  const cleaned = String(value || fallback)
    .replace(/[/\\]/g, "_")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return cleaned || fallback;
}
