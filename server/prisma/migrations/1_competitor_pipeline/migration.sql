-- AlterTable
ALTER TABLE "apps" ADD COLUMN     "pipeline" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "competitor_ads" (
    "id" UUID NOT NULL,
    "app_id" UUID NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'trendtrack',
    "external_id" TEXT NOT NULL,
    "advertiser" TEXT,
    "page_id" TEXT,
    "media_type" TEXT,
    "thumbnail_url" TEXT,
    "days_running" INTEGER,
    "reach" DOUBLE PRECISION,
    "content" JSONB NOT NULL DEFAULT '{}',
    "raw" JSONB NOT NULL DEFAULT '{}',
    "stage" TEXT NOT NULL DEFAULT 'SPOTTED',
    "error" TEXT,
    "reference_id" UUID,
    "creative_id" UUID,
    "render_job_id" UUID,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitor_ads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competitor_ads_app_id_stage_idx" ON "competitor_ads"("app_id", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_ads_app_id_source_external_id_key" ON "competitor_ads"("app_id", "source", "external_id");

-- AddForeignKey
ALTER TABLE "competitor_ads" ADD CONSTRAINT "competitor_ads_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_ads" ADD CONSTRAINT "competitor_ads_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "reference_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_ads" ADD CONSTRAINT "competitor_ads_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

