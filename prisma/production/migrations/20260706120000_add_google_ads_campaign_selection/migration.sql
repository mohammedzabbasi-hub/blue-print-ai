ALTER TABLE "AdPlatformConnection" ADD COLUMN "campaignSyncMode" TEXT NOT NULL DEFAULT 'all';

CREATE TABLE "GoogleAdsCampaign" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google_ads',
    "customerId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "campaignStatus" TEXT,
    "advertisingChannelType" TEXT,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoogleAdsCampaign_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GoogleAdsCampaign_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AdPlatformConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "GoogleAdsCampaign_shop_customerId_campaignId_key" ON "GoogleAdsCampaign"("shop", "customerId", "campaignId");
CREATE INDEX "GoogleAdsCampaign_shop_customerId_selected_idx" ON "GoogleAdsCampaign"("shop", "customerId", "selected");
CREATE INDEX "GoogleAdsCampaign_connectionId_lastSeenAt_idx" ON "GoogleAdsCampaign"("connectionId", "lastSeenAt");
