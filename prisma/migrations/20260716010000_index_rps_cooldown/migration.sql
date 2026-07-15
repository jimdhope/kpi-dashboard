DROP INDEX IF EXISTS "RpsGame_playerId_idx";
CREATE INDEX "RpsGame_playerId_createdAt_idx" ON "RpsGame"("playerId", "createdAt");
