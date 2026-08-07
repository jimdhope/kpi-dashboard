CREATE TYPE "QuizShowQuestionType" AS ENUM ('singleChoice', 'trueFalse', 'multipleChoice');
CREATE TYPE "QuizShowQuizMode" AS ENUM ('saved', 'random');
CREATE TYPE "QuizShowPhase" AS ENUM ('lobby', 'answering', 'reveal', 'complete');

CREATE TABLE "QuizShowQuestion" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuizShowQuestionType" NOT NULL DEFAULT 'singleChoice',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mediaUrl" TEXT,
    "mediaOriginalName" TEXT,
    "mediaContentType" TEXT,
    "mediaSize" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuizShowQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuizShowAnswerOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "QuizShowAnswerOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuizShowQuiz" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mode" "QuizShowQuizMode" NOT NULL DEFAULT 'saved',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "questionCount" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuizShowQuiz_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuizShowQuizQuestion" (
    "quizId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "QuizShowQuizQuestion_pkey" PRIMARY KEY ("quizId", "questionId")
);

CREATE TABLE "QuizShowRoom" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "phase" "QuizShowPhase" NOT NULL DEFAULT 'lobby',
    "currentQuestion" INTEGER NOT NULL DEFAULT -1,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "questionStartedAt" TIMESTAMP(3),
    "answerDeadlineAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuizShowRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuizShowRoomQuestion" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "QuizShowRoomQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuizShowParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "cumulativeResponseMs" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuizShowParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuizShowAnswer" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roomQuestionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "selectedOptionIds" JSONB NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "responseMs" INTEGER NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizShowAnswer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuizShowQuestion_isActive_createdAt_idx" ON "QuizShowQuestion"("isActive", "createdAt");
CREATE INDEX "QuizShowQuestion_createdById_idx" ON "QuizShowQuestion"("createdById");
CREATE INDEX "QuizShowAnswerOption_questionId_idx" ON "QuizShowAnswerOption"("questionId");
CREATE UNIQUE INDEX "QuizShowAnswerOption_questionId_position_key" ON "QuizShowAnswerOption"("questionId", "position");
CREATE INDEX "QuizShowQuiz_isActive_createdAt_idx" ON "QuizShowQuiz"("isActive", "createdAt");
CREATE INDEX "QuizShowQuiz_createdById_idx" ON "QuizShowQuiz"("createdById");
CREATE INDEX "QuizShowQuizQuestion_questionId_idx" ON "QuizShowQuizQuestion"("questionId");
CREATE UNIQUE INDEX "QuizShowQuizQuestion_quizId_position_key" ON "QuizShowQuizQuestion"("quizId", "position");
CREATE UNIQUE INDEX "QuizShowRoom_code_key" ON "QuizShowRoom"("code");
CREATE INDEX "QuizShowRoom_hostId_idx" ON "QuizShowRoom"("hostId");
CREATE INDEX "QuizShowRoom_phase_createdAt_idx" ON "QuizShowRoom"("phase", "createdAt");
CREATE INDEX "QuizShowRoomQuestion_questionId_idx" ON "QuizShowRoomQuestion"("questionId");
CREATE UNIQUE INDEX "QuizShowRoomQuestion_roomId_position_key" ON "QuizShowRoomQuestion"("roomId", "position");
CREATE UNIQUE INDEX "QuizShowRoomQuestion_roomId_questionId_key" ON "QuizShowRoomQuestion"("roomId", "questionId");
CREATE INDEX "QuizShowParticipant_roomId_score_idx" ON "QuizShowParticipant"("roomId", "score");
CREATE UNIQUE INDEX "QuizShowParticipant_roomId_userId_key" ON "QuizShowParticipant"("roomId", "userId");
CREATE UNIQUE INDEX "QuizShowParticipant_roomId_displayOrder_key" ON "QuizShowParticipant"("roomId", "displayOrder");
CREATE INDEX "QuizShowAnswer_roomId_roomQuestionId_idx" ON "QuizShowAnswer"("roomId", "roomQuestionId");
CREATE INDEX "QuizShowAnswer_participantId_idx" ON "QuizShowAnswer"("participantId");
CREATE UNIQUE INDEX "QuizShowAnswer_roomQuestionId_participantId_key" ON "QuizShowAnswer"("roomQuestionId", "participantId");

ALTER TABLE "QuizShowQuestion" ADD CONSTRAINT "QuizShowQuestion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuizShowAnswerOption" ADD CONSTRAINT "QuizShowAnswerOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizShowQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizShowQuiz" ADD CONSTRAINT "QuizShowQuiz_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuizShowQuizQuestion" ADD CONSTRAINT "QuizShowQuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "QuizShowQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizShowQuizQuestion" ADD CONSTRAINT "QuizShowQuizQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizShowQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuizShowRoom" ADD CONSTRAINT "QuizShowRoom_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizShowRoom" ADD CONSTRAINT "QuizShowRoom_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "QuizShowQuiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuizShowRoomQuestion" ADD CONSTRAINT "QuizShowRoomQuestion_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "QuizShowRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizShowRoomQuestion" ADD CONSTRAINT "QuizShowRoomQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizShowQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuizShowParticipant" ADD CONSTRAINT "QuizShowParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "QuizShowRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizShowParticipant" ADD CONSTRAINT "QuizShowParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizShowAnswer" ADD CONSTRAINT "QuizShowAnswer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "QuizShowRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizShowAnswer" ADD CONSTRAINT "QuizShowAnswer_roomQuestionId_fkey" FOREIGN KEY ("roomQuestionId") REFERENCES "QuizShowRoomQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizShowAnswer" ADD CONSTRAINT "QuizShowAnswer_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "QuizShowParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
