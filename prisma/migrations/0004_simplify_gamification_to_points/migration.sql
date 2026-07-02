-- 1. Add totalPoints to User
ALTER TABLE "User" ADD COLUMN "totalPoints" INTEGER DEFAULT 0;

-- 2. Migrate totalXp from AgentProfile to User.totalPoints
UPDATE "User" u 
SET "totalPoints" = ap."totalXp" 
FROM "AgentProfile" ap 
WHERE u.id = ap."userId";

-- 3. Update AgentBadge to use userId instead of agentProfileId
ALTER TABLE "AgentBadge" ADD COLUMN "userId" TEXT;

UPDATE "AgentBadge" ab 
SET "userId" = ap."userId" 
FROM "AgentProfile" ap 
WHERE ab."agentProfileId" = ap.id;

-- 4. Make userId mandatory and drop agentProfileId
ALTER TABLE "AgentBadge" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "AgentBadge" DROP COLUMN "agentProfileId";

-- 5. Update constraints for AgentBadge
ALTER TABLE "AgentBadge" ADD CONSTRAINT "AgentBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
-- Drop the old unique constraint that used agentProfileId
ALTER TABLE "AgentBadge" DROP CONSTRAINT IF EXISTS "AgentBadge_agentProfileId_badgeId_key";
ALTER TABLE "AgentBadge" ADD CONSTRAINT "AgentBadge_userId_badgeId_key" UNIQUE ("userId", "badgeId");

-- 6. Drop redundant tables
DROP TABLE "XpTransaction";
DROP TABLE "Streak";
DROP TABLE "CompetitionResult";
DROP TABLE "AgentProfile";
