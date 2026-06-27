-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "handle" TEXT,
    "normalizedHandle" TEXT,
    "name" TEXT,
    "normalizedName" TEXT,
    "normalizedPlatformName" TEXT,
    "profileUrl" TEXT,
    "platform" TEXT,
    "type" TEXT,
    "email" TEXT,
    "commission" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CreatorAttribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "creativePerformanceId" TEXT NOT NULL,
    "campaignId" TEXT,
    "clicks" REAL,
    "orders" REAL,
    "revenue" REAL,
    "spend" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreatorAttribution_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreatorAttribution_creativePerformanceId_fkey" FOREIGN KEY ("creativePerformanceId") REFERENCES "CreativePerformance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreatorAttribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Creator_shop_normalizedHandle_key" ON "Creator"("shop", "normalizedHandle");
CREATE INDEX "Creator_shop_normalizedName_idx" ON "Creator"("shop", "normalizedName");
CREATE INDEX "Creator_shop_normalizedPlatformName_idx" ON "Creator"("shop", "normalizedPlatformName");
CREATE INDEX "Creator_shop_updatedAt_idx" ON "Creator"("shop", "updatedAt");
CREATE UNIQUE INDEX "CreatorAttribution_creativePerformanceId_key" ON "CreatorAttribution"("creativePerformanceId");
CREATE INDEX "CreatorAttribution_shop_creatorId_idx" ON "CreatorAttribution"("shop", "creatorId");
CREATE INDEX "CreatorAttribution_shop_campaignId_idx" ON "CreatorAttribution"("shop", "campaignId");
