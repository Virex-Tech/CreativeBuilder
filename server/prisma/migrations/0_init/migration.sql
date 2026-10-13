-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "OutputKind" AS ENUM ('VIDEO', 'IMAGE', 'CAROUSEL');

-- CreateEnum
CREATE TYPE "CreativeStatus" AS ENUM ('DRAFT', 'READY', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('GENERATED_VIDEO', 'GENERATED_IMAGE', 'UPLOAD', 'SCREEN_RECORDING', 'VOICEOVER', 'MUSIC', 'RENDER', 'REFERENCE_FRAME');

-- CreateEnum
CREATE TYPE "RenderKind" AS ENUM ('VIDEO', 'STILL');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apps" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "niche" TEXT,
    "director" JSONB NOT NULL DEFAULT '{}',
    "brand_kit" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_assets" (
    "id" UUID NOT NULL,
    "app_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_url" TEXT,
    "file_path" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "manifest" JSONB NOT NULL DEFAULT '{}',
    "blueprint" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL,
    "app_id" UUID,
    "reference_id" UUID,
    "name" TEXT NOT NULL,
    "niche" TEXT,
    "blueprint" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creatives" (
    "id" UUID NOT NULL,
    "app_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "template_id" UUID,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "output_kind" "OutputKind" NOT NULL DEFAULT 'VIDEO',
    "status" "CreativeStatus" NOT NULL DEFAULT 'DRAFT',
    "parent_id" UUID,
    "mutation" TEXT,
    "locale_group_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_versions" (
    "id" UUID NOT NULL,
    "creative_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "spec" JSONB NOT NULL,
    "spec_hash" TEXT NOT NULL,
    "created_by" TEXT NOT NULL DEFAULT 'human',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "app_id" UUID NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "content_hash" TEXT,
    "path" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "duration_ms" INTEGER,
    "prompt" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "credits_used" DOUBLE PRECISION,
    "provider_url_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "render_jobs" (
    "id" UUID NOT NULL,
    "creative_id" UUID NOT NULL,
    "creative_version_id" UUID NOT NULL,
    "kind" "RenderKind" NOT NULL DEFAULT 'VIDEO',
    "frame" INTEGER,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "external_job_id" TEXT,
    "output_path" TEXT,
    "error" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "render_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_metrics" (
    "id" UUID NOT NULL,
    "creative_id" UUID NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'META_ADS_CSV',
    "captured_at" TIMESTAMP(3) NOT NULL,
    "window_days" INTEGER NOT NULL DEFAULT 1,
    "metrics" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "apps_slug_key" ON "apps"("slug");

-- CreateIndex
CREATE INDEX "apps_owner_id_idx" ON "apps"("owner_id");

-- CreateIndex
CREATE INDEX "reference_assets_app_id_created_at_idx" ON "reference_assets"("app_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "templates_app_id_idx" ON "templates"("app_id");

-- CreateIndex
CREATE INDEX "creatives_app_id_created_at_idx" ON "creatives"("app_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "creatives_parent_id_idx" ON "creatives"("parent_id");

-- CreateIndex
CREATE INDEX "creatives_locale_group_id_idx" ON "creatives"("locale_group_id");

-- CreateIndex
CREATE INDEX "creative_versions_spec_hash_idx" ON "creative_versions"("spec_hash");

-- CreateIndex
CREATE UNIQUE INDEX "creative_versions_creative_id_version_key" ON "creative_versions"("creative_id", "version");

-- CreateIndex
CREATE INDEX "assets_app_id_kind_idx" ON "assets"("app_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "assets_app_id_content_hash_key" ON "assets"("app_id", "content_hash");

-- CreateIndex
CREATE INDEX "render_jobs_creative_id_created_at_idx" ON "render_jobs"("creative_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "render_jobs_status_idx" ON "render_jobs"("status");

-- CreateIndex
CREATE INDEX "creative_metrics_creative_id_captured_at_idx" ON "creative_metrics"("creative_id", "captured_at" DESC);

-- AddForeignKey
ALTER TABLE "apps" ADD CONSTRAINT "apps_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_assets" ADD CONSTRAINT "reference_assets_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_assets" ADD CONSTRAINT "reference_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "reference_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "creatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_versions" ADD CONSTRAINT "creative_versions_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_creative_version_id_fkey" FOREIGN KEY ("creative_version_id") REFERENCES "creative_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

