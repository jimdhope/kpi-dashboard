ALTER TABLE "MemeMatchRoom" ADD COLUMN "displayToken" TEXT;
ALTER TABLE "QuizShowRoom" ADD COLUMN "displayToken" TEXT;

UPDATE "MemeMatchRoom"
SET "displayToken" = md5(random()::text || clock_timestamp()::text || "id")
WHERE "displayToken" IS NULL;

UPDATE "QuizShowRoom"
SET "displayToken" = md5(random()::text || clock_timestamp()::text || "id")
WHERE "displayToken" IS NULL;

ALTER TABLE "MemeMatchRoom" ALTER COLUMN "displayToken" SET NOT NULL;
ALTER TABLE "QuizShowRoom" ALTER COLUMN "displayToken" SET NOT NULL;

CREATE UNIQUE INDEX "MemeMatchRoom_displayToken_key" ON "MemeMatchRoom"("displayToken");
CREATE UNIQUE INDEX "QuizShowRoom_displayToken_key" ON "QuizShowRoom"("displayToken");
