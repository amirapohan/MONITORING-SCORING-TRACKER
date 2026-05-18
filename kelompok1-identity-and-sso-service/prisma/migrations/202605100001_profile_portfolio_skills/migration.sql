-- AlterTable
ALTER TABLE "users"
ADD COLUMN "username" TEXT;

-- CreateTable
CREATE TABLE "user_oauth_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "users_id" UUID NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "availability_status" TEXT,
    "hourly_rate" DECIMAL(12,2),
    "experience_level" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "skill_categories_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_skills" (
    "id" UUID NOT NULL,
    "skills_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sub_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users_skills" (
    "users_id" UUID NOT NULL,
    "skills_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_skills_pkey" PRIMARY KEY ("users_id","skills_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_oauth_accounts_provider_provider_id_key" ON "user_oauth_accounts"("provider", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_oauth_accounts_user_id_provider_key" ON "user_oauth_accounts"("user_id", "provider");

-- CreateIndex
CREATE INDEX "user_oauth_accounts_user_id_idx" ON "user_oauth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_users_id_key" ON "user_profiles"("users_id");

-- CreateIndex
CREATE INDEX "portfolios_user_id_idx" ON "portfolios"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_categories_name_key" ON "skill_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "skills_skill_categories_id_name_key" ON "skills"("skill_categories_id", "name");

-- CreateIndex
CREATE INDEX "skills_skill_categories_id_idx" ON "skills"("skill_categories_id");

-- CreateIndex
CREATE UNIQUE INDEX "sub_skills_skills_id_name_key" ON "sub_skills"("skills_id", "name");

-- CreateIndex
CREATE INDEX "sub_skills_skills_id_idx" ON "sub_skills"("skills_id");

-- CreateIndex
CREATE INDEX "users_skills_skills_id_idx" ON "users_skills"("skills_id");

-- AddForeignKey
ALTER TABLE "user_oauth_accounts"
ADD CONSTRAINT "user_oauth_accounts_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles"
ADD CONSTRAINT "user_profiles_users_id_fkey"
FOREIGN KEY ("users_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios"
ADD CONSTRAINT "portfolios_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills"
ADD CONSTRAINT "skills_skill_categories_id_fkey"
FOREIGN KEY ("skill_categories_id") REFERENCES "skill_categories"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_skills"
ADD CONSTRAINT "sub_skills_skills_id_fkey"
FOREIGN KEY ("skills_id") REFERENCES "skills"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_skills"
ADD CONSTRAINT "users_skills_users_id_fkey"
FOREIGN KEY ("users_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_skills"
ADD CONSTRAINT "users_skills_skills_id_fkey"
FOREIGN KEY ("skills_id") REFERENCES "skills"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
