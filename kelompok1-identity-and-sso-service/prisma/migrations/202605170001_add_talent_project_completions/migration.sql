-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PROJECT_COMPLETED';

-- CreateTable
CREATE TABLE "talent_project_completions" (
    "id" UUID NOT NULL,
    "talent_id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "ipfs_uri" TEXT NOT NULL,
    "completion_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_project_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "talent_project_completions_talent_id_idx" ON "talent_project_completions"("talent_id");

-- CreateIndex
CREATE INDEX "talent_project_completions_project_id_idx" ON "talent_project_completions"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "talent_project_completions_talent_id_project_id_key" ON "talent_project_completions"("talent_id", "project_id");

-- AddForeignKey
ALTER TABLE "talent_project_completions"
ADD CONSTRAINT "talent_project_completions_talent_id_fkey"
FOREIGN KEY ("talent_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
