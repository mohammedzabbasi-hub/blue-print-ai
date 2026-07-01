PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_AdPlatformConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "externalAccountName" TEXT,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" DATETIME,
    "scopes" TEXT,
    "metadataJson" TEXT,
    "lastSyncedAt" DATETIME,
    "lastSyncError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_AdPlatformConnection" (
    "id", "shop", "platform", "externalAccountId", "externalAccountName",
    "encryptedAccessToken", "encryptedRefreshToken", "tokenExpiresAt", "scopes",
    "metadataJson", "lastSyncedAt", "lastSyncError", "createdAt", "updatedAt"
)
SELECT
    "id", "shop", "platform", "externalAccountId", "externalAccountName",
    "encryptedAccessToken", "encryptedRefreshToken", "tokenExpiresAt", "scopes",
    "metadataJson", "lastSyncedAt", "lastSyncError", "createdAt", "updatedAt"
FROM "AdPlatformConnection";

DROP TABLE "AdPlatformConnection";
ALTER TABLE "new_AdPlatformConnection" RENAME TO "AdPlatformConnection";
CREATE UNIQUE INDEX "AdPlatformConnection_shop_platform_key" ON "AdPlatformConnection"("shop", "platform");
CREATE INDEX "AdPlatformConnection_shop_updatedAt_idx" ON "AdPlatformConnection"("shop", "updatedAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
