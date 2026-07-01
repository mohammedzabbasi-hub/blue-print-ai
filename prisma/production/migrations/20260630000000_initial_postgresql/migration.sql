-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedBrief" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoAnalysis" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "fileName" TEXT,
    "brief" TEXT,
    "payloadJson" TEXT NOT NULL,
    "savedToLibrary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedCreative" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "angle" TEXT,
    "payloadJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedCreative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueBlueprint" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevenueBlueprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceRequest" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "payloadJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceSetting" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "payloadJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativePerformance" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "creativeId" TEXT,
    "platform" TEXT,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "adsetId" TEXT,
    "adsetName" TEXT,
    "adGroupId" TEXT,
    "adGroupName" TEXT,
    "adId" TEXT,
    "adName" TEXT,
    "creatorHandle" TEXT,
    "creatorName" TEXT,
    "productId" TEXT,
    "productName" TEXT,
    "productHandle" TEXT,
    "thumbnailUrl" TEXT,
    "videoUrl" TEXT,
    "assetUrl" TEXT,
    "sourceUrl" TEXT,
    "sourceType" TEXT,
    "sourceRecordId" TEXT,
    "sourceRecordType" TEXT,
    "importKey" TEXT,
    "reportingDate" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "impressions" DOUBLE PRECISION,
    "reach" DOUBLE PRECISION,
    "clicks" DOUBLE PRECISION,
    "spend" DOUBLE PRECISION,
    "conversions" DOUBLE PRECISION,
    "orders" DOUBLE PRECISION,
    "revenue" DOUBLE PRECISION,
    "conversionValue" DOUBLE PRECISION,
    "ctr" DOUBLE PRECISION,
    "cpc" DOUBLE PRECISION,
    "cpm" DOUBLE PRECISION,
    "cvr" DOUBLE PRECISION,
    "roas" DOUBLE PRECISION,
    "videoViews" DOUBLE PRECISION,
    "video2SecondViews" DOUBLE PRECISION,
    "video3SecondViews" DOUBLE PRECISION,
    "video25PercentWatched" DOUBLE PRECISION,
    "video50PercentWatched" DOUBLE PRECISION,
    "video75PercentWatched" DOUBLE PRECISION,
    "video100PercentWatched" DOUBLE PRECISION,
    "averageWatchTime" DOUBLE PRECISION,
    "engagements" DOUBLE PRECISION,
    "likes" DOUBLE PRECISION,
    "comments" DOUBLE PRECISION,
    "shares" DOUBLE PRECISION,
    "payloadJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativePerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
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
    "commission" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorAttribution" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "creativePerformanceId" TEXT NOT NULL,
    "campaignId" TEXT,
    "clicks" DOUBLE PRECISION,
    "orders" DOUBLE PRECISION,
    "revenue" DOUBLE PRECISION,
    "spend" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "objective" TEXT NOT NULL DEFAULT 'awareness',
    "platform" TEXT NOT NULL DEFAULT 'manual',
    "primaryProductName" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budget" DOUBLE PRECISION,
    "targetAudience" TEXT,
    "notes" TEXT,
    "externalCampaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCampaignCreative" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "savedCreativeId" TEXT,
    "creativePerformanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdCampaignCreative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPlatformConnection" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "externalAccountName" TEXT,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "metadataJson" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdPlatformConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPerformanceDaily" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT,
    "shop" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "rowKey" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "externalAccountName" TEXT,
    "reportingDate" TIMESTAMP(3) NOT NULL,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "adGroupId" TEXT,
    "adGroupName" TEXT,
    "adId" TEXT,
    "adName" TEXT,
    "currencyCode" TEXT,
    "impressions" DOUBLE PRECISION,
    "reach" DOUBLE PRECISION,
    "clicks" DOUBLE PRECISION,
    "spend" DOUBLE PRECISION,
    "conversions" DOUBLE PRECISION,
    "revenue" DOUBLE PRECISION,
    "videoViews" DOUBLE PRECISION,
    "engagements" DOUBLE PRECISION,
    "payloadJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdPerformanceDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedBrief_shop_createdAt_idx" ON "SavedBrief"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "SavedBrief_shop_productId_idx" ON "SavedBrief"("shop", "productId");

-- CreateIndex
CREATE INDEX "VideoAnalysis_shop_createdAt_idx" ON "VideoAnalysis"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "VideoAnalysis_shop_productId_idx" ON "VideoAnalysis"("shop", "productId");

-- CreateIndex
CREATE INDEX "SavedCreative_shop_createdAt_idx" ON "SavedCreative"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "SavedCreative_shop_productId_idx" ON "SavedCreative"("shop", "productId");

-- CreateIndex
CREATE INDEX "RevenueBlueprint_shop_createdAt_idx" ON "RevenueBlueprint"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceRequest_shop_createdAt_idx" ON "WorkspaceRequest"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceRequest_shop_type_idx" ON "WorkspaceRequest"("shop", "type");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceSetting_shop_key_key" ON "WorkspaceSetting"("shop", "key");

-- CreateIndex
CREATE INDEX "ActivityLog_shop_createdAt_idx" ON "ActivityLog"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_shop_type_idx" ON "ActivityLog"("shop", "type");

-- CreateIndex
CREATE INDEX "ActivityLog_shop_relatedType_relatedId_idx" ON "ActivityLog"("shop", "relatedType", "relatedId");

-- CreateIndex
CREATE INDEX "CreativePerformance_shop_reportingDate_idx" ON "CreativePerformance"("shop", "reportingDate");

-- CreateIndex
CREATE INDEX "CreativePerformance_shop_platform_idx" ON "CreativePerformance"("shop", "platform");

-- CreateIndex
CREATE INDEX "CreativePerformance_shop_creatorHandle_idx" ON "CreativePerformance"("shop", "creatorHandle");

-- CreateIndex
CREATE INDEX "CreativePerformance_shop_productHandle_idx" ON "CreativePerformance"("shop", "productHandle");

-- CreateIndex
CREATE INDEX "CreativePerformance_shop_creativeId_idx" ON "CreativePerformance"("shop", "creativeId");

-- CreateIndex
CREATE INDEX "CreativePerformance_shop_sourceType_idx" ON "CreativePerformance"("shop", "sourceType");

-- CreateIndex
CREATE INDEX "CreativePerformance_shop_sourceRecordType_sourceRecordId_idx" ON "CreativePerformance"("shop", "sourceRecordType", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "CreativePerformance_shop_importKey_key" ON "CreativePerformance"("shop", "importKey");

-- CreateIndex
CREATE INDEX "Creator_shop_normalizedName_idx" ON "Creator"("shop", "normalizedName");

-- CreateIndex
CREATE INDEX "Creator_shop_normalizedPlatformName_idx" ON "Creator"("shop", "normalizedPlatformName");

-- CreateIndex
CREATE INDEX "Creator_shop_updatedAt_idx" ON "Creator"("shop", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_shop_normalizedHandle_key" ON "Creator"("shop", "normalizedHandle");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorAttribution_creativePerformanceId_key" ON "CreatorAttribution"("creativePerformanceId");

-- CreateIndex
CREATE INDEX "CreatorAttribution_shop_creatorId_idx" ON "CreatorAttribution"("shop", "creatorId");

-- CreateIndex
CREATE INDEX "CreatorAttribution_shop_campaignId_idx" ON "CreatorAttribution"("shop", "campaignId");

-- CreateIndex
CREATE INDEX "AdCampaign_shop_status_idx" ON "AdCampaign"("shop", "status");

-- CreateIndex
CREATE INDEX "AdCampaign_shop_updatedAt_idx" ON "AdCampaign"("shop", "updatedAt");

-- CreateIndex
CREATE INDEX "AdCampaign_shop_externalCampaignId_idx" ON "AdCampaign"("shop", "externalCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "AdCampaign_shop_normalizedName_key" ON "AdCampaign"("shop", "normalizedName");

-- CreateIndex
CREATE INDEX "AdCampaignCreative_shop_campaignId_idx" ON "AdCampaignCreative"("shop", "campaignId");

-- CreateIndex
CREATE INDEX "AdCampaignCreative_shop_savedCreativeId_idx" ON "AdCampaignCreative"("shop", "savedCreativeId");

-- CreateIndex
CREATE INDEX "AdCampaignCreative_shop_creativePerformanceId_idx" ON "AdCampaignCreative"("shop", "creativePerformanceId");

-- CreateIndex
CREATE UNIQUE INDEX "AdCampaignCreative_campaignId_savedCreativeId_key" ON "AdCampaignCreative"("campaignId", "savedCreativeId");

-- CreateIndex
CREATE UNIQUE INDEX "AdCampaignCreative_campaignId_creativePerformanceId_key" ON "AdCampaignCreative"("campaignId", "creativePerformanceId");

-- CreateIndex
CREATE INDEX "AdPlatformConnection_shop_updatedAt_idx" ON "AdPlatformConnection"("shop", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdPlatformConnection_shop_platform_key" ON "AdPlatformConnection"("shop", "platform");

-- CreateIndex
CREATE INDEX "AdPerformanceDaily_shop_reportingDate_idx" ON "AdPerformanceDaily"("shop", "reportingDate");

-- CreateIndex
CREATE INDEX "AdPerformanceDaily_shop_platform_externalAccountId_idx" ON "AdPerformanceDaily"("shop", "platform", "externalAccountId");

-- CreateIndex
CREATE INDEX "AdPerformanceDaily_connectionId_reportingDate_idx" ON "AdPerformanceDaily"("connectionId", "reportingDate");

-- CreateIndex
CREATE UNIQUE INDEX "AdPerformanceDaily_shop_platform_rowKey_key" ON "AdPerformanceDaily"("shop", "platform", "rowKey");

-- AddForeignKey
ALTER TABLE "CreatorAttribution" ADD CONSTRAINT "CreatorAttribution_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorAttribution" ADD CONSTRAINT "CreatorAttribution_creativePerformanceId_fkey" FOREIGN KEY ("creativePerformanceId") REFERENCES "CreativePerformance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorAttribution" ADD CONSTRAINT "CreatorAttribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaignCreative" ADD CONSTRAINT "AdCampaignCreative_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaignCreative" ADD CONSTRAINT "AdCampaignCreative_savedCreativeId_fkey" FOREIGN KEY ("savedCreativeId") REFERENCES "SavedCreative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaignCreative" ADD CONSTRAINT "AdCampaignCreative_creativePerformanceId_fkey" FOREIGN KEY ("creativePerformanceId") REFERENCES "CreativePerformance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPerformanceDaily" ADD CONSTRAINT "AdPerformanceDaily_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AdPlatformConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

