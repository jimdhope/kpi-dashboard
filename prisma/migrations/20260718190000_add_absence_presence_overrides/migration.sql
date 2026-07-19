CREATE TABLE "AbsencePresenceOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AbsencePresenceOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AbsencePresenceOverride_userId_date_key" ON "AbsencePresenceOverride"("userId", "date");
CREATE INDEX "AbsencePresenceOverride_date_idx" ON "AbsencePresenceOverride"("date");
