const GENERIC_PRODUCT_TITLES = new Set([
  "uploaded product",
  "uploaded video",
  "product",
  "creative",
]);

export function generateCreativeTitleAndSummary({
  productTitle = "",
  fileName = "",
  transcriptText = "",
  ocrText = "",
  analysis = {},
  metadata = {},
  preferredTitle = "",
  preferredSummary = "",
} = {}) {
  const cleanName = cleanUploadedFilename(fileName);
  const product = normalizeProductTitle(productTitle);
  const safePreferredSummary = sanitizePreferredSummary(preferredSummary, fileName);
  const signals = [
    cleanName,
    transcriptText,
    ocrText,
    analysis.summary,
    analysis.pacingNotes,
    analysis.hook_type,
    analysis.creator_type,
    analysis.creator_style,
    analysis.delivery_style,
    ...(Array.isArray(analysis.recommendations) ? analysis.recommendations : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const format = inferCreativeFormat(signals, metadata);
  const title = sentenceCase(
    preferredTitle ||
      buildTitle({
        product,
        cleanName,
        format,
        signals,
      }),
  );
  const summary =
    safePreferredSummary ||
    buildSummary({
      product,
      format,
      signals,
      hasTranscriptOrOcr: Boolean(transcriptText || ocrText),
    });

  return {
    displayTitle: title,
    generatedTitle: title,
    summary,
    description: summary,
    originalFilename: fileName || "",
    cleanedFilename: cleanName,
    generationSource:
      transcriptText || ocrText
        ? "Generated from uploaded file metadata, extracted text, and saved analysis signals."
        : "Generated from uploaded file metadata and saved analysis signals.",
  };
}

export function cleanUploadedFilename(fileName = "") {
  const withoutExtension = String(fileName || "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[._-]+/g, " ");
  const withoutUuid = withoutExtension.replace(
    /\b[0-9a-f]{8}\s[0-9a-f]{4}\s[0-9a-f]{4}\s[0-9a-f]{4}\s[0-9a-f]{12}\b/gi,
    " ",
  );
  const cleaned = withoutUuid
    .replace(/\b[0-9a-f]{12,}\b/gi, " ")
    .replace(/\b\d{10,}\b/g, " ")
    .replace(/\b\d{5,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || /^[\d\s-]+$/.test(cleaned)) return "";

  return cleaned
    .split(" ")
    .filter((part) => part.length > 1 || /[a-z]/i.test(part))
    .join(" ")
    .trim();
}

function normalizeProductTitle(productTitle = "") {
  const normalized = String(productTitle || "").trim();

  if (!normalized || GENERIC_PRODUCT_TITLES.has(normalized.toLowerCase())) {
    return "";
  }

  return normalized;
}

function inferCreativeFormat(signals, metadata = {}) {
  if (/before|after|routine|transformation/.test(signals)) {
    return "before-and-after routine clip";
  }

  if (/testimonial|review|ugc|creator|voiceover/.test(signals)) {
    return "UGC product testimonial";
  }

  if (/close ?up|macro|texture|visual|frame|ocr/.test(signals)) {
    return "creator-led product close-up demo";
  }

  if (/problem|solution|pain point|hook/.test(signals)) {
    return "problem-solution product demo";
  }

  const duration = Number(metadata.duration_seconds || 0);

  if (duration > 0 && duration <= 20) {
    return "short-form product demo";
  }

  return "product demo creative";
}

function buildTitle({ product, cleanName, format, signals }) {
  if (product && /serum|skincare|skin|beauty|routine/.test(`${product} ${signals}`.toLowerCase())) {
    if (/testimonial|ugc|creator/.test(signals)) {
      return `UGC product testimonial for ${product}`;
    }

    if (/before|after|routine/.test(signals)) {
      return `${product} routine clip`;
    }

    return `${product} application demo`;
  }

  if (product) {
    return `${product} ${format}`.replace(/\s+/g, " ");
  }

  if (cleanName && !looksLikeStorageName(cleanName)) {
    return `${cleanName} ${format}`.replace(/\s+/g, " ");
  }

  return format || "Uploaded creative analysis";
}

function buildSummary({ product, format, signals, hasTranscriptOrOcr }) {
  const subject = product ? `the ${product}` : "the product";

  if (/testimonial|ugc|creator/.test(format)) {
    return `A creator-style video presents ${subject}, explains the likely benefit, and gives the clip a UGC planning structure.`;
  }

  if (/before-and-after|routine/.test(format)) {
    return `A routine-style creative frames ${subject} around use, benefit explanation, and visual proof for a short-form planning test.`;
  }

  if (/problem-solution/.test(format)) {
    return `A problem-solution creative introduces ${subject}, points toward the main benefit, and can be used to plan a stronger hook and CTA.`;
  }

  if (hasTranscriptOrOcr) {
    return `The upload includes extractable text or audio signals, which were used with file metadata to generate this creative summary.`;
  }

  if (/cta|clarity|hook/.test(signals)) {
    return `The video was summarized from uploaded file metadata and saved hook, clarity, and CTA analysis signals.`;
  }

  return "Generated creative summary based on uploaded file metadata and saved analysis signals.";
}

function sanitizePreferredSummary(summary = "", fileName = "") {
  const text = String(summary || "").trim();

  if (!text) return "";

  const rawFile = String(fileName || "").trim();

  if (rawFile && text.includes(rawFile)) return "";
  if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(text)) {
    return "";
  }
  if (/\b[0-9a-f]{12,}\b/i.test(text) && /creative analysis saved/i.test(text)) {
    return "";
  }

  return text;
}

function sentenceCase(value = "") {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "Uploaded creative analysis";

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function looksLikeStorageName(value = "") {
  const compact = String(value || "").replace(/\s+/g, "");

  return compact.length > 24 && /^[a-f0-9-]+$/i.test(compact);
}
