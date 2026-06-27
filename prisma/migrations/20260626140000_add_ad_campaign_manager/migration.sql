-- Preserve CreativePerformance.campaignId as the external/source platform ID.
-- Workspace campaign membership is represented by AdCampaignCreative.
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "goal" TEXT NOT NULL DEFAULT 'awareness',
    "platform" TEXT NOT NULL DEFAULT 'manual',
    "primaryProductName" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "budget" REAL,
    "targetAudience" TEXT,
    "notes" TEXT,
    "externalCampaignId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "AdCampaignCreative" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "savedCreativeId" TEXT,
    "creativePerformanceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdCampaignCreative_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdCampaignCreative_savedCreativeId_fkey" FOREIGN KEY ("savedCreativeId") REFERENCES "SavedCreative" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdCampaignCreative_creativePerformanceId_fkey" FOREIGN KEY ("creativePerformanceId") REFERENCES "CreativePerformance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AdCampaign_shop_normalizedName_key" ON "AdCampaign"("shop", "normalizedName");
CREATE INDEX "AdCampaign_shop_status_idx" ON "AdCampaign"("shop", "status");
CREATE INDEX "AdCampaign_shop_updatedAt_idx" ON "AdCampaign"("shop", "updatedAt");
CREATE INDEX "AdCampaign_shop_externalCampaignId_idx" ON "AdCampaign"("shop", "externalCampaignId");
CREATE UNIQUE INDEX "AdCampaignCreative_campaignId_savedCreativeId_key" ON "AdCampaignCreative"("campaignId", "savedCreativeId");
CREATE UNIQUE INDEX "AdCampaignCreative_campaignId_creativePerformanceId_key" ON "AdCampaignCreative"("campaignId", "creativePerformanceId");
CREATE INDEX "AdCampaignCreative_shop_campaignId_idx" ON "AdCampaignCreative"("shop", "campaignId");
CREATE INDEX "AdCampaignCreative_shop_savedCreativeId_idx" ON "AdCampaignCreative"("shop", "savedCreativeId");
CREATE INDEX "AdCampaignCreative_shop_creativePerformanceId_idx" ON "AdCampaignCreative"("shop", "creativePerformanceId");
