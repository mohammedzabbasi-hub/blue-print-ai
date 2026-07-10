const TECHNICAL_ERROR_PATTERN =
  /\b(?:prisma|database|sql|stack|filesystem|environment variable|process\.env|api[_ -]?key|client[_ -]?secret|developer[_ -]?token|encryption[_ -]?key|refresh[_ -]?token|bearer|http\s*\d{3}|request id)\b|\/(?:app|usr|var|private|tmp)\//i;
const ENVIRONMENT_NAME_PATTERN = /\b[A-Z][A-Z0-9_]{3,}\b/;

export function merchantErrorMessage(error, fallback) {
  const message = String(error?.message || error || "").trim();

  if (
    !message ||
    TECHNICAL_ERROR_PATTERN.test(message) ||
    ENVIRONMENT_NAME_PATTERN.test(message)
  ) return fallback;

  return message;
}

export function googleAdsMerchantError(error, fallback = "Google Ads could not complete that request. Try again shortly.") {
  const message = String(error?.message || error || "").trim();
  const normalized = message.toLowerCase();

  if (/permission|access denied|forbidden|not authorized/.test(normalized)) {
    return "Google Ads did not grant access to this account. Reconnect and confirm the requested reporting permission.";
  }
  if (/not configured|configuration|missing|api[_ -]?key|client[_ -]?secret|developer[_ -]?token|encryption/.test(normalized)) {
    return "Google Ads is temporarily unavailable. Contact support if you need help connecting.";
  }
  if (/refresh|credential|token|authoriz|oauth/.test(normalized)) {
    return "Google Ads authorization expired or could not be refreshed. Reconnect the account and try again.";
  }
  if (/timeout|timed out|network|fetch|unreachable|temporarily unavailable/.test(normalized)) {
    return "Google Ads could not be reached. Try again shortly.";
  }
  if (/select at least one campaign/.test(normalized)) {
    return "Select at least one campaign before syncing.";
  }
  if (/select only campaigns/.test(normalized)) {
    return "Select only campaigns available in this Google Ads account.";
  }
  if (/connect and select|select a google ads account/.test(normalized)) {
    return "Connect and select a Google Ads account first.";
  }

  return merchantErrorMessage(message, fallback);
}
