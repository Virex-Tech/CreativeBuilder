-- CreateTable
CREATE TABLE "social_accounts" (
    "id" UUID NOT NULL,
    "app_id" UUID NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'INSTAGRAM',
    "handle" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "persona" TEXT,
    "style" TEXT,
    "slot_times" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "drive_folder" TEXT,
    "auto_publish" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ig_user_id" TEXT,
    "ig_username" TEXT,
    "access_token_enc" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "app_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "instructions" TEXT,
    "caption" TEXT,
    "reference_id" UUID,
    "creative_id" UUID,
    "render_job_id" UUID,
    "video_file" TEXT,
    "revision_note" TEXT,
    "revisions" JSONB NOT NULL DEFAULT '[]',
    "upload_token" TEXT NOT NULL,
    "approved_at" TIMESTAMP(3),
    "ig_container_id" TEXT,
    "external_id" TEXT,
    "permalink" TEXT,
    "published_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "takes" (
    "id" UUID NOT NULL,
    "app_id" UUID NOT NULL,
    "account_id" UUID,
    "post_id" UUID,
    "source" TEXT NOT NULL DEFAULT 'UPLOAD',
    "source_url" TEXT,
    "source_id" TEXT,
    "original_name" TEXT,
    "raw_path" TEXT,
    "file" TEXT,
    "thumb_file" TEXT,
    "duration_ms" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "has_audio" BOOLEAN NOT NULL DEFAULT true,
    "transcript" JSONB,
    "prompt" TEXT,
    "provider_task" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "takes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_accounts_app_id_idx" ON "social_accounts"("app_id");

-- CreateIndex
CREATE UNIQUE INDEX "posts_upload_token_key" ON "posts"("upload_token");

-- CreateIndex
CREATE INDEX "posts_account_id_scheduled_at_idx" ON "posts"("account_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "posts_status_updated_at_idx" ON "posts"("status", "updated_at");

-- CreateIndex
CREATE INDEX "takes_post_id_idx" ON "takes"("post_id");

-- CreateIndex
CREATE INDEX "takes_status_created_at_idx" ON "takes"("status", "created_at");

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "reference_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "takes" ADD CONSTRAINT "takes_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "takes" ADD CONSTRAINT "takes_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "social_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "takes" ADD CONSTRAINT "takes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

