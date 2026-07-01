-- CreateTable
CREATE TABLE "AdPlatformConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "externalAccountName" TEXT,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" DATETIME,
    "scopes" TEXT,
    "metadataJson" TEXT,
    "lastSyncedAt" DATETIME,
    "lastSyncError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdPerformanceDaily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT,
    "shop" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "rowKey" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "externalAccountName" TEXT,
    "reportingDate" DATETIME NOT NULL,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "adGroupId" TEXT,
    "adGroupName" TEXT,
    "adId" TEXT,
    "adName" TEXT,
    "currencyCode" TEXT,
    "impressions" REAL,
    "reach" REAL,
    "clicks" REAL,
    "spend" REAL,
    "conversions" REAL,
    "revenue" REAL,
    "videoViews" REAL,
    "engagements" REAL,
    "payloadJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdPerformanceDaily_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AdPlatformConnection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AdPlatformConnection_shop_platform_key" ON "AdPlatformConnection"("shop", "platform");
CREATE INDEX "AdPlatformConnection_shop_updatedAt_idx" ON "AdPlatformConnection"("shop", "updatedAt");
CREATE UNIQUE INDEX "AdPerformanceDaily_shop_platform_rowKey_key" ON "AdPerformanceDaily"("shop", "platform", "rowKey");
CREATE INDEX "AdPerformanceDaily_shop_reportingDate_idx" ON "AdPerformanceDaily"("shop", "reportingDate");
CREATE INDEX "AdPerformanceDaily_shop_platform_externalAccountId_idx" ON "AdPerformanceDaily"("shop", "platform", "externalAccountId");
CREATE INDEX "AdPerformanceDaily_connectionId_reportingDate_idx" ON "AdPerformanceDaily"("connectionId", "reportingDate");
