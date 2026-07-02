import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function getEncryptionKey() {
  const configuredKey =
    process.env.GOOGLE_ADS_ENCRYPTION_SECRET ||
    process.env.AD_PLATFORM_TOKEN_ENCRYPTION_KEY;

  if (!configuredKey) {
    throw new Error(
      "GOOGLE_ADS_ENCRYPTION_SECRET or AD_PLATFORM_TOKEN_ENCRYPTION_KEY is required to store ad platform tokens.",
    );
  }

  const key = /^[a-f\d]{64}$/i.test(configuredKey)
    ? Buffer.from(configuredKey, "hex")
    : Buffer.from(configuredKey, "base64");

  if (key.length !== 32) {
    throw new Error(
      "AD_PLATFORM_TOKEN_ENCRYPTION_KEY must be a 32-byte key encoded as base64 or 64-character hex.",
    );
  }

  return key;
}

export function encryptToken(value) {
  if (typeof value !== "string" || !value) {
    throw new Error("A non-empty token is required for encryption.");
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [VERSION, iv, authTag, ciphertext]
    .map((part) => (Buffer.isBuffer(part) ? part.toString("base64url") : part))
    .join(".");
}

export function decryptToken(encryptedValue) {
  const [version, encodedIv, encodedAuthTag, encodedCiphertext, ...rest] =
    String(encryptedValue || "").split(".");

  if (
    version !== VERSION ||
    !encodedIv ||
    !encodedAuthTag ||
    !encodedCiphertext ||
    rest.length
  ) {
    throw new Error("The encrypted token payload is invalid or unsupported.");
  }

  try {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getEncryptionKey(),
      Buffer.from(encodedIv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(encodedAuthTag, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    throw new Error("The encrypted token could not be decrypted.", {
      cause: error,
    });
  }
}
