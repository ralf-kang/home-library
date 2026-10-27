-- Additive update for databases created before personal library customization.
-- Apply before deploying the generated Prisma client / new application build.
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "library_appearance" JSONB;
