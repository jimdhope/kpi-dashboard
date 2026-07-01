-- CreateEnum
CREATE TYPE "AwardScope" AS ENUM ('COMPETITION', 'MONTHLY', 'YEARLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "TeamsWebhookDirection" AS ENUM ('incoming', 'outgoing');

-- CreateEnum
CREATE TYPE "TeamsChannelCategory" AS ENUM ('daily_summary', 'leaderboard', 'alert', 'campaign', 'custom');

-- CreateEnum
CREATE TYPE "TeamsAutomationTrigger" AS ENUM ('incomingWebhookReceived', 'performanceLogged', 'competitionScoreLogged');

-- CreateEnum
CREATE TYPE "TeamsAutomationScope" AS ENUM ('global', 'campaign', 'pod');

-- CreateEnum
CREATE TYPE "TeamsAutomationMode" AS ENUM ('event', 'oneTime', 'recurring');

-- CreateEnum
CREATE TYPE "TeamsAutomationConditionEvent" AS ENUM ('performanceLogged', 'competitionScoreLogged');

-- CreateEnum
CREATE TYPE "TeamsAutomationConditionMetric" AS ENUM ('count', 'totalValue');

-- CreateEnum
CREATE TYPE "TeamsAutomationDeliveryFormat" AS ENUM ('messageCard', 'adaptiveCard', 'adaptiveCardWithImage');

-- CreateEnum
CREATE TYPE "KpiType" AS ENUM ('number', 'percentage', 'scoreOutOf');

-- CreateEnum
CREATE TYPE "ScoreTargetType" AS ENUM ('competition', 'tracker');

-- CreateEnum
CREATE TYPE "KpiSortOrder" AS ENUM ('desc', 'asc');

-- CreateEnum
CREATE TYPE "PassFailOperator" AS ENUM ('gte', 'lte');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "agentName" TEXT,
ADD COLUMN     "recorderId" TEXT,
ADD COLUMN     "recorderName" TEXT,
ADD COLUMN     "richMessage" TEXT;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "incomingWebhookId" TEXT,
ADD COLUMN     "outgoingWebhookId" TEXT;

-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "draftData" JSONB,
ADD COLUMN     "isDraft" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "podIds" TEXT[];

-- AlterTable
ALTER TABLE "CompetitionEntry" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "present" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CompetitionRule" ADD COLUMN     "dailyTarget" INTEGER,
ADD COLUMN     "emoji" TEXT,
ADD COLUMN     "isCheckbox" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CompetitionTeam" ADD COLUMN     "agentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "emoji" TEXT;

-- AlterTable
ALTER TABLE "Pod" ADD COLUMN     "incomingWebhookId" TEXT,
ADD COLUMN     "outgoingWebhookId" TEXT,
ADD COLUMN     "podManagerId" TEXT,
ADD COLUMN     "teamLeaderId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firebaseUid" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "podId" TEXT;

-- CreateTable
CREATE TABLE "Kpi" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initials" VARCHAR(4) NOT NULL,
    "type" "KpiType" NOT NULL DEFAULT 'number',
    "maxValue" DECIMAL(65,30),
    "sortOrder" "KpiSortOrder" NOT NULL DEFAULT 'desc',
    "passFailCriteriaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "passFailOperator" "PassFailOperator",
    "passFailValue" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiLog" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "userId" TEXT,
    "value" DECIMAL(65,30) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionScoreLog" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "ruleId" TEXT,
    "value" INTEGER NOT NULL DEFAULT 0,
    "isBonus" BOOLEAN NOT NULL DEFAULT false,
    "bonusTeamId" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionScoreLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionRuleTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionRuleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotificationSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyCompetitions" BOOLEAN NOT NULL DEFAULT true,
    "notifyTrackers" BOOLEAN NOT NULL DEFAULT true,
    "notifyAchievements" BOOLEAN NOT NULL DEFAULT true,
    "notifySystem" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT DEFAULT '22:00',
    "quietHoursEnd" TEXT DEFAULT '08:00',
    "quietHoursTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "pushSubscription" TEXT,
    "pushEndpoint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppPushSettings" (
    "id" TEXT NOT NULL DEFAULT 'push',
    "vapidPublicKey" TEXT,
    "vapidPrivateKey" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppPushSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamsWebhookEndpoint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "friendlyName" TEXT,
    "direction" "TeamsWebhookDirection" NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "category" "TeamsChannelCategory",
    "testStatus" TEXT DEFAULT 'untested',
    "lastTestedAt" TIMESTAMP(3),
    "lastPostAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamsWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamsAutomation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "TeamsAutomationTrigger" NOT NULL,
    "scope" "TeamsAutomationScope" NOT NULL DEFAULT 'global',
    "mode" "TeamsAutomationMode" NOT NULL DEFAULT 'event',
    "deliveryFormat" "TeamsAutomationDeliveryFormat" NOT NULL DEFAULT 'messageCard',
    "messageTemplateId" TEXT,
    "campaignId" TEXT,
    "podId" TEXT,
    "outgoingWebhookId" TEXT NOT NULL,
    "titleTemplate" TEXT NOT NULL,
    "messageTemplate" TEXT NOT NULL,
    "factsJson" JSONB,
    "adaptiveCardJson" JSONB,
    "imageTitleTemplate" TEXT,
    "imageSubtitleTemplate" TEXT,
    "imageMetricTemplate" TEXT,
    "imageFooterTemplate" TEXT,
    "imageAccentColor" TEXT,
    "oneTimeAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "timezone" TEXT DEFAULT 'UTC',
    "windowStartTime" TEXT,
    "windowEndTime" TEXT,
    "quietStartTime" TEXT,
    "quietEndTime" TEXT,
    "repeatEveryMinutes" INTEGER,
    "batchWindowMinutes" INTEGER,
    "cooldownMinutes" INTEGER,
    "conditionEvent" "TeamsAutomationConditionEvent",
    "conditionMetric" "TeamsAutomationConditionMetric",
    "conditionLookbackMinutes" INTEGER,
    "conditionMinimumCount" INTEGER,
    "conditionMinimumValue" DOUBLE PRECISION,
    "onlyIfNewData" BOOLEAN NOT NULL DEFAULT false,
    "conditionActivityWithinMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamsAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamsMessageTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TeamsChannelCategory",
    "version" INTEGER NOT NULL DEFAULT 1,
    "deliveryFormat" "TeamsAutomationDeliveryFormat" NOT NULL DEFAULT 'messageCard',
    "titleTemplate" TEXT NOT NULL,
    "messageTemplate" TEXT NOT NULL,
    "factsJson" JSONB,
    "adaptiveCardJson" JSONB,
    "imageTitleTemplate" TEXT,
    "imageSubtitleTemplate" TEXT,
    "imageMetricTemplate" TEXT,
    "imageFooterTemplate" TEXT,
    "imageAccentColor" TEXT,
    "variationsJson" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamsMessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamsAutomationPendingDelivery" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "factsJson" JSONB,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "TeamsAutomationPendingDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamsIncomingEvent" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "endpointName" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "headersJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamsIncomingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreTarget" (
    "id" TEXT NOT NULL,
    "hashtag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetType" "ScoreTargetType" NOT NULL,
    "competitionId" TEXT,
    "trackerKpiId" TEXT,
    "defaultPoints" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "iconType" TEXT DEFAULT 'emoji',
    "scope" "AwardScope" NOT NULL DEFAULT 'COMPETITION',
    "criteria" JSONB,
    "rankTinted" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentBadge" (
    "id" TEXT NOT NULL,
    "agentProfileId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "competitionId" TEXT,
    "context" JSONB,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionResult" (
    "id" TEXT NOT NULL,
    "agentProfileId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "wasPresent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Streak" (
    "id" TEXT NOT NULL,
    "agentProfileId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'win',
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "longestCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Streak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAchievement" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleName" TEXT,
    "value" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL,
    "loggedBy" TEXT,
    "loggedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTaskLog" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "podId" TEXT,
    "taskId" TEXT NOT NULL,
    "taskName" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyTaskLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamBonusLog" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT,
    "podId" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "loggedBy" TEXT,
    "loggedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamBonusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodTarget" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "targetsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpsGame" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerThrow" TEXT NOT NULL,
    "opponentThrow" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RpsGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "collections" JSONB NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KBCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KBArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "excerpt" TEXT,
    "categoryId" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "lockedRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KBVersion" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KBVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KBComment" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'external',
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'person',
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "companyName" TEXT,
    "departmentName" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_KBArticleToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_KBArticleToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ContactToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContactToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "KpiLog_kpiId_idx" ON "KpiLog"("kpiId");

-- CreateIndex
CREATE INDEX "KpiLog_userId_idx" ON "KpiLog"("userId");

-- CreateIndex
CREATE INDEX "KpiLog_loggedAt_idx" ON "KpiLog"("loggedAt");

-- CreateIndex
CREATE INDEX "KpiLog_date_idx" ON "KpiLog"("date");

-- CreateIndex
CREATE UNIQUE INDEX "UserNotificationSettings_userId_key" ON "UserNotificationSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserNotificationSettings_pushEndpoint_key" ON "UserNotificationSettings"("pushEndpoint");

-- CreateIndex
CREATE INDEX "TeamsAutomation_trigger_scope_isActive_idx" ON "TeamsAutomation"("trigger", "scope", "isActive");

-- CreateIndex
CREATE INDEX "TeamsAutomationPendingDelivery_automationId_dueAt_sentAt_idx" ON "TeamsAutomationPendingDelivery"("automationId", "dueAt", "sentAt");

-- CreateIndex
CREATE INDEX "TeamsIncomingEvent_endpointId_createdAt_idx" ON "TeamsIncomingEvent"("endpointId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreTarget_hashtag_key" ON "ScoreTarget"("hashtag");

-- CreateIndex
CREATE INDEX "ScoreTarget_hashtag_idx" ON "ScoreTarget"("hashtag");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_userId_key" ON "AgentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_key_key" ON "Badge"("key");

-- CreateIndex
CREATE INDEX "AgentBadge_competitionId_idx" ON "AgentBadge"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentBadge_agentProfileId_badgeId_key" ON "AgentBadge"("agentProfileId", "badgeId");

-- CreateIndex
CREATE INDEX "CompetitionResult_agentProfileId_idx" ON "CompetitionResult"("agentProfileId");

-- CreateIndex
CREATE INDEX "CompetitionResult_competitionId_idx" ON "CompetitionResult"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionResult_agentProfileId_competitionId_key" ON "CompetitionResult"("agentProfileId", "competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "Streak_agentProfileId_type_key" ON "Streak"("agentProfileId", "type");

-- CreateIndex
CREATE INDEX "XpTransaction_userId_idx" ON "XpTransaction"("userId");

-- CreateIndex
CREATE INDEX "XpTransaction_createdAt_idx" ON "XpTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "DailyAchievement_competitionId_idx" ON "DailyAchievement"("competitionId");

-- CreateIndex
CREATE INDEX "DailyAchievement_agentId_idx" ON "DailyAchievement"("agentId");

-- CreateIndex
CREATE INDEX "DailyAchievement_podId_idx" ON "DailyAchievement"("podId");

-- CreateIndex
CREATE INDEX "DailyAchievement_date_idx" ON "DailyAchievement"("date");

-- CreateIndex
CREATE INDEX "DailyTaskLog_competitionId_idx" ON "DailyTaskLog"("competitionId");

-- CreateIndex
CREATE INDEX "DailyTaskLog_agentId_idx" ON "DailyTaskLog"("agentId");

-- CreateIndex
CREATE INDEX "DailyTaskLog_date_idx" ON "DailyTaskLog"("date");

-- CreateIndex
CREATE INDEX "TeamBonusLog_competitionId_idx" ON "TeamBonusLog"("competitionId");

-- CreateIndex
CREATE INDEX "TeamBonusLog_teamId_idx" ON "TeamBonusLog"("teamId");

-- CreateIndex
CREATE INDEX "TeamBonusLog_podId_idx" ON "TeamBonusLog"("podId");

-- CreateIndex
CREATE INDEX "TeamBonusLog_date_idx" ON "TeamBonusLog"("date");

-- CreateIndex
CREATE INDEX "PodTarget_competitionId_idx" ON "PodTarget"("competitionId");

-- CreateIndex
CREATE INDEX "PodTarget_podId_idx" ON "PodTarget"("podId");

-- CreateIndex
CREATE UNIQUE INDEX "PodTarget_competitionId_podId_date_key" ON "PodTarget"("competitionId", "podId", "date");

-- CreateIndex
CREATE INDEX "RpsGame_playerId_idx" ON "RpsGame"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "Tag_name_idx" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "KBCategory_slug_key" ON "KBCategory"("slug");

-- CreateIndex
CREATE INDEX "KBCategory_slug_idx" ON "KBCategory"("slug");

-- CreateIndex
CREATE INDEX "KBCategory_parentId_idx" ON "KBCategory"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "KBArticle_slug_key" ON "KBArticle"("slug");

-- CreateIndex
CREATE INDEX "KBArticle_slug_idx" ON "KBArticle"("slug");

-- CreateIndex
CREATE INDEX "KBArticle_status_idx" ON "KBArticle"("status");

-- CreateIndex
CREATE INDEX "KBArticle_categoryId_idx" ON "KBArticle"("categoryId");

-- CreateIndex
CREATE INDEX "KBArticle_createdById_idx" ON "KBArticle"("createdById");

-- CreateIndex
CREATE INDEX "KBVersion_articleId_idx" ON "KBVersion"("articleId");

-- CreateIndex
CREATE INDEX "KBComment_articleId_idx" ON "KBComment"("articleId");

-- CreateIndex
CREATE INDEX "KBComment_parentId_idx" ON "KBComment"("parentId");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE INDEX "Company_type_idx" ON "Company"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE INDEX "Contact_name_idx" ON "Contact"("name");

-- CreateIndex
CREATE INDEX "Contact_type_idx" ON "Contact"("type");

-- CreateIndex
CREATE INDEX "_KBArticleToTag_B_index" ON "_KBArticleToTag"("B");

-- CreateIndex
CREATE INDEX "_ContactToTag_B_index" ON "_ContactToTag"("B");

-- CreateIndex
CREATE INDEX "Activity_userId_createdAt_idx" ON "Activity"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- AddForeignKey
ALTER TABLE "KpiLog" ADD CONSTRAINT "KpiLog_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiLog" ADD CONSTRAINT "KpiLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_incomingWebhookId_fkey" FOREIGN KEY ("incomingWebhookId") REFERENCES "TeamsWebhookEndpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_outgoingWebhookId_fkey" FOREIGN KEY ("outgoingWebhookId") REFERENCES "TeamsWebhookEndpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pod" ADD CONSTRAINT "Pod_incomingWebhookId_fkey" FOREIGN KEY ("incomingWebhookId") REFERENCES "TeamsWebhookEndpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pod" ADD CONSTRAINT "Pod_outgoingWebhookId_fkey" FOREIGN KEY ("outgoingWebhookId") REFERENCES "TeamsWebhookEndpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pod" ADD CONSTRAINT "Pod_teamLeaderId_fkey" FOREIGN KEY ("teamLeaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pod" ADD CONSTRAINT "Pod_podManagerId_fkey" FOREIGN KEY ("podManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerKpi" ADD CONSTRAINT "TrackerKpi_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionScoreLog" ADD CONSTRAINT "CompetitionScoreLog_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CompetitionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotificationSettings" ADD CONSTRAINT "UserNotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamsAutomation" ADD CONSTRAINT "TeamsAutomation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamsAutomation" ADD CONSTRAINT "TeamsAutomation_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamsAutomation" ADD CONSTRAINT "TeamsAutomation_outgoingWebhookId_fkey" FOREIGN KEY ("outgoingWebhookId") REFERENCES "TeamsWebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamsAutomation" ADD CONSTRAINT "TeamsAutomation_messageTemplateId_fkey" FOREIGN KEY ("messageTemplateId") REFERENCES "TeamsMessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamsAutomationPendingDelivery" ADD CONSTRAINT "TeamsAutomationPendingDelivery_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "TeamsAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamsIncomingEvent" ADD CONSTRAINT "TeamsIncomingEvent_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "TeamsWebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentBadge" ADD CONSTRAINT "AgentBadge_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "AgentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentBadge" ADD CONSTRAINT "AgentBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentBadge" ADD CONSTRAINT "AgentBadge_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionResult" ADD CONSTRAINT "CompetitionResult_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "AgentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionResult" ADD CONSTRAINT "CompetitionResult_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Streak" ADD CONSTRAINT "Streak_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "AgentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpTransaction" ADD CONSTRAINT "XpTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBCategory" ADD CONSTRAINT "KBCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "KBCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBArticle" ADD CONSTRAINT "KBArticle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "KBCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBArticle" ADD CONSTRAINT "KBArticle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBVersion" ADD CONSTRAINT "KBVersion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KBArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBVersion" ADD CONSTRAINT "KBVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBComment" ADD CONSTRAINT "KBComment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KBArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBComment" ADD CONSTRAINT "KBComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "KBComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBComment" ADD CONSTRAINT "KBComment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_KBArticleToTag" ADD CONSTRAINT "_KBArticleToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "KBArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_KBArticleToTag" ADD CONSTRAINT "_KBArticleToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContactToTag" ADD CONSTRAINT "_ContactToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContactToTag" ADD CONSTRAINT "_ContactToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
