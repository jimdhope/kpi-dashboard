-- AlterTable
ALTER TABLE "AgentBadge" ADD COLUMN IF NOT EXISTS "competitionId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentBadge_competitionId_idx" ON "AgentBadge"("competitionId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AgentBadge_competitionId_fkey'
  ) THEN
    ALTER TABLE "AgentBadge"
      ADD CONSTRAINT "AgentBadge_competitionId_fkey"
      FOREIGN KEY ("competitionId") REFERENCES "Competition"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
