-- AlterTable
ALTER TABLE "AgentBadge" ADD COLUMN "competitionId" TEXT;

-- CreateIndex
CREATE INDEX "AgentBadge_competitionId_idx" ON "AgentBadge"("competitionId");

-- AddForeignKey
ALTER TABLE "AgentBadge" ADD CONSTRAINT "AgentBadge_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
