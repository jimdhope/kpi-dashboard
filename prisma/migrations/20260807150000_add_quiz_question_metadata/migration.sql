ALTER TABLE "QuizShowQuestion" ADD COLUMN "title" TEXT;
ALTER TABLE "QuizShowQuestion" ADD COLUMN "category" TEXT;
ALTER TABLE "QuizShowQuestion" ADD COLUMN "internalNotes" TEXT;
CREATE INDEX "QuizShowQuestion_category_idx" ON "QuizShowQuestion"("category");
