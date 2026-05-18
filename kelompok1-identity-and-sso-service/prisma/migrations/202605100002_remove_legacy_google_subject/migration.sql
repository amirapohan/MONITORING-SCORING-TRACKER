-- DropIndex
DROP INDEX IF EXISTS "users_google_subject_key";

-- AlterTable
ALTER TABLE "users"
DROP COLUMN IF EXISTS "google_subject";
