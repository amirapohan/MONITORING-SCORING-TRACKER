-- Rename UserRole enum values from old Indonesian names to marketplace terms
-- Production DB was initialized before commit 8c5ab0a which renamed values in-place
-- This migration reconciles: mahasiswa→talent, mitra→client

DO $$
BEGIN
  -- Rename 'mahasiswa' to 'talent' if it exists and 'talent' does not
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'mahasiswa'
  ) THEN
    ALTER TYPE "UserRole" RENAME VALUE 'mahasiswa' TO 'talent';
  END IF;

  -- Rename 'mitra' to 'client' if it exists and 'client' does not
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'mitra'
  ) THEN
    ALTER TYPE "UserRole" RENAME VALUE 'mitra' TO 'client';
  END IF;
END $$;
