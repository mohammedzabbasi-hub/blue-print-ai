-- CreateTable
CREATE TABLE "SavedBrief" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VideoAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "fileName" TEXT,
    "brief" TEXT,
    "payloadJson" TEXT NOT NULL,
    "savedToLibrary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SavedCreative" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "angle" TEXT,
    "payloadJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RevenueBlueprint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkspaceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "payloadJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkspaceSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
