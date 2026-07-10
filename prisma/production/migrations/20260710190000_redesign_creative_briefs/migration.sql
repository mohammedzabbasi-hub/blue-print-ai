ALTER TABLE "SavedBrief" ADD COLUMN "title" TEXT;
ALTER TABLE "SavedBrief" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "SavedBrief" ADD COLUMN "sourceCreativeId" TEXT;
ALTER TABLE "SavedBrief" ADD COLUMN "sourceVideoAnalysisId" TEXT;
ALTER TABLE "SavedBrief" ADD COLUMN "campaignObjective" TEXT;
ALTER TABLE "SavedBrief" ADD COLUMN "targetAudience" TEXT;
ALTER TABLE "SavedBrief" ADD COLUMN "platform" TEXT;
ALTER TABLE "SavedBrief" ADD COLUMN "creativeFormat" TEXT;
ALTER TABLE "SavedBrief" ADD COLUMN "tone" TEXT;
ALTER TABLE "SavedBrief" ADD COLUMN "merchantNotes" TEXT;
ALTER TABLE "SavedBrief" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "SavedBrief_idempotencyKey_key" ON "SavedBrief"("idempotencyKey");
CREATE INDEX "SavedBrief_shop_updatedAt_idx" ON "SavedBrief"("shop", "updatedAt");
