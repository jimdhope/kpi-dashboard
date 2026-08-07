-- CreateEnum
CREATE TYPE "MemeMatchPhase" AS ENUM ('lobby', 'submitting', 'voting', 'reveal', 'complete');

-- CreateTable
CREATE TABLE "MemeMatchPrompt" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemeMatchPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemeMatchRoom" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "phase" "MemeMatchPhase" NOT NULL DEFAULT 'lobby',
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 3,
    "activePromptId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemeMatchRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemeMatchParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemeMatchParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemeMatchRound" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "promptId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "advancedToVoteAt" TIMESTAMP(3),
    "revealedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MemeMatchRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemeMatchSubmission" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gifId" TEXT NOT NULL,
    "gifUrl" TEXT NOT NULL,
    "gifTitle" TEXT,
    "previewUrl" TEXT,
    "caption" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemeMatchSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemeMatchVote" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemeMatchVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemeMatchPrompt_isActive_createdAt_idx" ON "MemeMatchPrompt"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "MemeMatchPrompt_category_idx" ON "MemeMatchPrompt"("category");

-- CreateIndex
CREATE UNIQUE INDEX "MemeMatchRoom_code_key" ON "MemeMatchRoom"("code");

-- CreateIndex
CREATE INDEX "MemeMatchRoom_hostId_idx" ON "MemeMatchRoom"("hostId");

-- CreateIndex
CREATE INDEX "MemeMatchRoom_phase_createdAt_idx" ON "MemeMatchRoom"("phase", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MemeMatchParticipant_roomId_userId_key" ON "MemeMatchParticipant"("roomId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MemeMatchParticipant_roomId_displayOrder_key" ON "MemeMatchParticipant"("roomId", "displayOrder");

-- CreateIndex
CREATE INDEX "MemeMatchParticipant_roomId_score_idx" ON "MemeMatchParticipant"("roomId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "MemeMatchRound_roomId_roundNumber_key" ON "MemeMatchRound"("roomId", "roundNumber");

-- CreateIndex
CREATE INDEX "MemeMatchRound_roomId_roundNumber_idx" ON "MemeMatchRound"("roomId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MemeMatchSubmission_roundId_participantId_key" ON "MemeMatchSubmission"("roundId", "participantId");

-- CreateIndex
CREATE INDEX "MemeMatchSubmission_roomId_roundId_idx" ON "MemeMatchSubmission"("roomId", "roundId");

-- CreateIndex
CREATE INDEX "MemeMatchSubmission_userId_idx" ON "MemeMatchSubmission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MemeMatchVote_roundId_voterId_key" ON "MemeMatchVote"("roundId", "voterId");

-- CreateIndex
CREATE UNIQUE INDEX "MemeMatchVote_roundId_voterId_submissionId_key" ON "MemeMatchVote"("roundId", "voterId", "submissionId");

-- CreateIndex
CREATE INDEX "MemeMatchVote_roomId_roundId_idx" ON "MemeMatchVote"("roomId", "roundId");

-- CreateIndex
CREATE INDEX "MemeMatchVote_submissionId_idx" ON "MemeMatchVote"("submissionId");

-- AddForeignKey
ALTER TABLE "MemeMatchPrompt" ADD CONSTRAINT "MemeMatchPrompt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemeMatchRoom" ADD CONSTRAINT "MemeMatchRoom_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemeMatchRoom" ADD CONSTRAINT "MemeMatchRoom_activePromptId_fkey" FOREIGN KEY ("activePromptId") REFERENCES "MemeMatchPrompt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemeMatchParticipant" ADD CONSTRAINT "MemeMatchParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MemeMatchRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemeMatchParticipant" ADD CONSTRAINT "MemeMatchParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemeMatchRound" ADD CONSTRAINT "MemeMatchRound_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MemeMatchRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemeMatchRound" ADD CONSTRAINT "MemeMatchRound_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "MemeMatchPrompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemeMatchSubmission" ADD CONSTRAINT "MemeMatchSubmission_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MemeMatchRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemeMatchSubmission" ADD CONSTRAINT "MemeMatchSubmission_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "MemeMatchRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemeMatchSubmission" ADD CONSTRAINT "MemeMatchSubmission_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "MemeMatchParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemeMatchSubmission" ADD CONSTRAINT "MemeMatchSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemeMatchVote" ADD CONSTRAINT "MemeMatchVote_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MemeMatchRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemeMatchVote" ADD CONSTRAINT "MemeMatchVote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "MemeMatchRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemeMatchVote" ADD CONSTRAINT "MemeMatchVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "MemeMatchParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemeMatchVote" ADD CONSTRAINT "MemeMatchVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "MemeMatchParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemeMatchVote" ADD CONSTRAINT "MemeMatchVote_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "MemeMatchSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed prompts
INSERT INTO "MemeMatchPrompt" ("id", "text", "category", "isActive", "createdAt", "updatedAt")
VALUES
  (substr(md5(random()::text || clock_timestamp()::text), 1, 32), 'Best caption for a Monday morning energy level.', 'work', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (substr(md5(random()::text || clock_timestamp()::text), 1, 32), 'What this chat looks like after someone says "quick question".', 'meetings', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (substr(md5(random()::text || clock_timestamp()::text), 1, 32), 'Caption the moment the spreadsheet finally works.', 'office', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (substr(md5(random()::text || clock_timestamp()::text), 1, 32), 'The most dramatic reaction to a calendar invite.', 'meetings', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (substr(md5(random()::text || clock_timestamp()::text), 1, 32), 'Make this GIF the face of internal feedback.', 'work', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
