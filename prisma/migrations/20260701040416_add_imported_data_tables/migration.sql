-- CreateTable
CREATE TABLE "ImportedProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" REAL,
    "currency" TEXT,
    "inventory" INTEGER,
    "status" TEXT,
    "imageUrl" TEXT,
    "category" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImportedOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "productExternalId" TEXT,
    "productTitle" TEXT,
    "amount" REAL NOT NULL DEFAULT 0,
    "currency" TEXT,
    "orderedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ImportedCreator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT,
    "platform" TEXT,
    "status" TEXT,
    "followers" INTEGER,
    "totalViews" INTEGER,
    "totalLikes" INTEGER,
    "totalComments" INTEGER,
    "totalShares" INTEGER,
    "totalOrders" INTEGER,
    "totalRevenue" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImportedCreative" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "productExternalId" TEXT,
    "productTitle" TEXT,
    "creatorHandle" TEXT,
    "platform" TEXT,
    "views" INTEGER,
    "likes" INTEGER,
    "shares" INTEGER,
    "clicks" INTEGER,
    "orders" INTEGER,
    "revenue" REAL,
    "hookType" TEXT,
    "mediaUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImportedMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "date" DATETIME,
    "scope" TEXT,
    "refId" TEXT,
    "views" INTEGER,
    "clicks" INTEGER,
    "orders" INTEGER,
    "revenue" REAL,
    "spend" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ImportedProduct_shop_idx" ON "ImportedProduct"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedProduct_shop_externalId_key" ON "ImportedProduct"("shop", "externalId");

-- CreateIndex
CREATE INDEX "ImportedOrder_shop_idx" ON "ImportedOrder"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedOrder_shop_externalId_key" ON "ImportedOrder"("shop", "externalId");

-- CreateIndex
CREATE INDEX "ImportedCreator_shop_idx" ON "ImportedCreator"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedCreator_shop_externalId_key" ON "ImportedCreator"("shop", "externalId");

-- CreateIndex
CREATE INDEX "ImportedCreative_shop_idx" ON "ImportedCreative"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedCreative_shop_externalId_key" ON "ImportedCreative"("shop", "externalId");

-- CreateIndex
CREATE INDEX "ImportedMetric_shop_idx" ON "ImportedMetric"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedMetric_shop_externalId_key" ON "ImportedMetric"("shop", "externalId");
