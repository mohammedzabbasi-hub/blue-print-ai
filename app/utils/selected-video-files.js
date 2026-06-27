export const CREATIVE_VIDEO_FILE_FIELD = "videoFiles";

export function selectedVideoFileKey(file) {
  return [
    String(file?.name || "").trim().toLowerCase(),
    Number(file?.size || 0),
    Number(file?.lastModified || 0),
  ].join(":");
}

export function appendSelectedVideoFiles(selectedVideos = [], incomingFiles = []) {
  const byKey = new Map(
    selectedVideos.map((file) => [selectedVideoFileKey(file), file]),
  );

  for (const file of Array.from(incomingFiles || [])) {
    const key = selectedVideoFileKey(file);

    if (!key || byKey.has(key)) continue;
    byKey.set(key, file);
  }

  return [...byKey.values()];
}

export function removeSelectedVideoFile(selectedVideos = [], fileToRemove) {
  const removeKey =
    typeof fileToRemove === "string"
      ? fileToRemove
      : selectedVideoFileKey(fileToRemove);

  return selectedVideos.filter(
    (file) => selectedVideoFileKey(file) !== removeKey,
  );
}

export function buildCreativeImportFormData({
  intent,
  csvText = "",
  csvFile,
  selectedVideos = [],
}) {
  const formData = new FormData();

  formData.set("intent", intent);
  formData.set("csvText", csvText);

  if (csvFile?.size > 0) {
    formData.set("csvFile", csvFile);
  }

  for (const file of selectedVideos) {
    formData.append(CREATIVE_VIDEO_FILE_FIELD, file);
  }

  return formData;
}
