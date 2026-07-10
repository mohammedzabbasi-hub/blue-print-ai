const PLAYABLE_VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm"];

export function normalizeExternalVideoUrl(value) {
  const input = String(value || "").trim();
  if (!input) return "";

  try {
    const url = new URL(input);
    const path = url.pathname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !PLAYABLE_VIDEO_EXTENSIONS.some((extension) => path.endsWith(extension))
    ) {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}
