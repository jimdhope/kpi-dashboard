CREATE TABLE "FeedbackMessage" (
  "id" TEXT NOT NULL,
  "feedbackId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FeedbackMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedbackMessage_feedbackId_createdAt_idx" ON "FeedbackMessage"("feedbackId", "createdAt");

ALTER TABLE "FeedbackMessage" ADD CONSTRAINT "FeedbackMessage_feedbackId_fkey"
  FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
