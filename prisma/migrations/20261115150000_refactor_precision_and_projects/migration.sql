-- 1. Remove Task foreign key, column, table, and enum
ALTER TABLE "time_entries" DROP CONSTRAINT IF EXISTS "time_entries_taskId_fkey";
ALTER TABLE "time_entries" DROP COLUMN IF EXISTS "taskId";
DROP TABLE IF EXISTS "tasks";
DROP TYPE IF EXISTS "TaskStatus";

-- 2. UserSettings: hourlyRate (Decimal) -> hourlyRateCents (Int)
ALTER TABLE "user_settings" ADD COLUMN "hourlyRateCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "user_settings"
SET "hourlyRateCents" = COALESCE(ROUND("hourlyRate" * 100)::INTEGER, 0);
ALTER TABLE "user_settings" DROP COLUMN "hourlyRate";

-- 3. Project: budgetHours -> budgetCents & estimatedSeconds, update ProjectStatus enum
ALTER TABLE "projects" ADD COLUMN "budgetCents" INTEGER;
ALTER TABLE "projects" ADD COLUMN "estimatedSeconds" INTEGER;
UPDATE "projects"
SET "estimatedSeconds" = ROUND("budgetHours" * 3600)::INTEGER
WHERE "budgetHours" IS NOT NULL;
ALTER TABLE "projects" DROP COLUMN "budgetHours";

CREATE TYPE "ProjectStatus_new" AS ENUM ('ACTIVE', 'COMPLETED', 'OVER_BUDGET');
ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "projects"
  ALTER COLUMN "status" TYPE "ProjectStatus_new"
  USING (
    CASE "status"::text
      WHEN 'concluido' THEN 'COMPLETED'::"ProjectStatus_new"
      WHEN 'arquivado' THEN 'COMPLETED'::"ProjectStatus_new"
      ELSE 'ACTIVE'::"ProjectStatus_new"
    END
  );
DROP TYPE "ProjectStatus";
ALTER TYPE "ProjectStatus_new" RENAME TO "ProjectStatus";
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- 4. TimeEntry: duration -> durationSeconds, add amountCents
ALTER TABLE "time_entries" RENAME COLUMN "duration" TO "durationSeconds";
ALTER TABLE "time_entries" ADD COLUMN "amountCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "time_entries" te
SET "amountCents" = ROUND((COALESCE(te."durationSeconds", 0)::BIGINT * COALESCE(us."hourlyRateCents", 0)::BIGINT) / 3600.0)::INTEGER
FROM "user_settings" us
WHERE te."userId" = us."userId" AND te."billable" = true AND te."durationSeconds" IS NOT NULL;

-- 5. Invoice: totalHours -> durationSeconds, totalValue -> amountCents
ALTER TABLE "invoices" ADD COLUMN "durationSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "amountCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "invoices"
SET "durationSeconds" = COALESCE(ROUND("totalHours" * 3600)::INTEGER, 0),
    "amountCents" = COALESCE(ROUND("totalValue" * 100)::INTEGER, 0);
ALTER TABLE "invoices" DROP COLUMN "totalHours";
ALTER TABLE "invoices" DROP COLUMN "totalValue";
