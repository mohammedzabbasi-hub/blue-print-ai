ALTER TABLE "VideoAnalysis" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'SAVED_REVIEW';
ALTER TABLE "VideoAnalysis" ADD COLUMN "sourceAnalysisId" TEXT;

CREATE INDEX "VideoAnalysis_shop_status_createdAt_idx" ON "VideoAnalysis"("shop", "status", "createdAt");
CREATE INDEX "VideoAnalysis_shop_sourceAnalysisId_idx" ON "VideoAnalysis"("shop", "sourceAnalysisId");
