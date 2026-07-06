ALTER TABLE "AdPerformanceDaily" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'live';
ALTER TABLE "AdPerformanceDaily" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "AdPerformanceDaily_shop_platform_isDemo_idx"
ON "AdPerformanceDaily"("shop", "platform", "isDemo");
