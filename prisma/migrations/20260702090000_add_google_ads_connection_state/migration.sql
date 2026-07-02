ALTER TABLE "AdPlatformConnection" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'connected';
ALTER TABLE "AdPlatformConnection" ADD COLUMN "googleAccountEmail" TEXT;
