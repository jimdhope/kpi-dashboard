-- Divisions League: additive league/assignment/title models only.
-- No existing table, column, or index is altered.

-- CreateEnum
CREATE TYPE "LeagueDivision" AS ENUM ('PREMIER', 'CHAMPIONSHIP', 'LEAGUE_ONE');

-- CreateEnum
CREATE TYPE "LeagueScopeType" AS ENUM ('POD', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "DivisionTitlePeriodType" AS ENUM ('MONTH', 'BLOCK');

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopeType" "LeagueScopeType" NOT NULL,
    "podId" TEXT,
    "campaignId" TEXT,
    "tierCount" INTEGER NOT NULL DEFAULT 3,
    "configJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DivisionAssignment" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "division" "LeagueDivision" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "assignedVia" TEXT,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DivisionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DivisionTitle" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "division" "LeagueDivision" NOT NULL,
    "periodType" "DivisionTitlePeriodType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "points" INTEGER NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "note" TEXT,

    CONSTRAINT "DivisionTitle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "League_scopeType_isActive_idx" ON "League"("scopeType", "isActive");

-- CreateIndex
CREATE INDEX "DivisionAssignment_leagueId_userId_effectiveTo_idx" ON "DivisionAssignment"("leagueId", "userId", "effectiveTo");

-- CreateIndex
CREATE INDEX "DivisionAssignment_userId_idx" ON "DivisionAssignment"("userId");

-- CreateIndex
CREATE INDEX "DivisionAssignment_leagueId_division_idx" ON "DivisionAssignment"("leagueId", "division");

-- CreateIndex
CREATE UNIQUE INDEX "DivisionTitle_leagueId_division_periodType_periodStart_key" ON "DivisionTitle"("leagueId", "division", "periodType", "periodStart");

-- CreateIndex
CREATE INDEX "DivisionTitle_leagueId_periodStart_idx" ON "DivisionTitle"("leagueId", "periodStart");

-- CreateIndex
CREATE INDEX "DivisionTitle_userId_idx" ON "DivisionTitle"("userId");

-- One current assignment per player per league
CREATE UNIQUE INDEX "DivisionAssignment_current_unique" ON "DivisionAssignment"("leagueId", "userId") WHERE "effectiveTo" IS NULL;
