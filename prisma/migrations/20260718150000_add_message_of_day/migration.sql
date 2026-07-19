CREATE TABLE "MessageOfDay" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MessageOfDay_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MessageOfDay_isActive_expiresAt_idx" ON "MessageOfDay"("isActive", "expiresAt");
