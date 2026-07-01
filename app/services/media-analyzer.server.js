const DEFAULT_ANALYZER_TIMEOUT_MS = 60_000;
const MAX_ANALYZER_TIMEOUT_MS = 10 * 60_000;

export function getAnalyzerRuntimeStatus(env = process.env) {
  if (String(env.ANALYZER_ENABLED || "").toLowerCase() !== "true") {
    return unavailableStatus("disabled");
  }

  const serviceUrl = String(env.ANALYZER_SERVICE_URL || "").trim();
  const apiKey = String(env.ANALYZER_API_KEY || "").trim();
  if (!serviceUrl || !apiKey) return unavailableStatus("missing_config");

  try {
    const parsedUrl = new URL(serviceUrl);
    if (!/^https?:$/.test(parsedUrl.protocol)) return unavailableStatus("invalid_config");
  } catch {
    return unavailableStatus("invalid_config");
  }

  return {
    configured: true,
    message: "Analyzer runtime configured.",
    serviceUrl,
    timeoutMs: analyzerTimeoutMs(env),
  };
}

export async function analyzeUploadedVideoFile(
  videoFile,
  { env = process.env, fetchImpl = fetch } = {},
) {
  const runtime = getAnalyzerRuntimeStatus(env);
  if (!runtime.configured) {
    return { available: false, reason: runtime.reason, message: runtime.message };
  }
  if (!videoFile || typeof videoFile.arrayBuffer !== "function" || !videoFile.size) {
    return failure("invalid_upload", "No valid uploaded video was available for analysis.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), runtime.timeoutMs);

  try {
    const formData = new FormData();
    formData.set("file", videoFile, videoFile.name || "upload.mp4");
    const response = await fetchImpl(runtime.serviceUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${String(env.ANALYZER_API_KEY).trim()}` },
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      return failure("service_error", `Analyzer service returned HTTP ${response.status}.`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      return failure("malformed_response", "Analyzer service returned an invalid response.");
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return failure("malformed_response", "Analyzer service returned an invalid response.");
    }
    if (payload.error || payload.fallback === true) {
      return failure("service_error", "Analyzer service could not analyze this video.");
    }

    return { available: true, ...payload };
  } catch (error) {
    if (error?.name === "AbortError" || controller.signal.aborted) {
      return failure("timeout", `Analyzer request timed out after ${runtime.timeoutMs} ms.`);
    }
    return failure("network_error", "Analyzer service is temporarily unavailable.");
  } finally {
    clearTimeout(timeout);
  }
}

function analyzerTimeoutMs(env) {
  const configured = Number(env.ANALYZER_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_ANALYZER_TIMEOUT_MS;
  return Math.min(Math.round(configured), MAX_ANALYZER_TIMEOUT_MS);
}

function unavailableStatus(reason) {
  return {
    configured: false,
    reason,
    message: "Analyzer unavailable in this environment.",
  };
}

function failure(reason, message) {
  return { available: false, reason, message };
}
