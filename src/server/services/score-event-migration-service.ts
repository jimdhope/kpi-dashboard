import "server-only";

import { prisma } from "@/server/db/client";
import { competitionSseService } from "@/server/services/competition-sse-service";

export type DailyAchievementBackfillResult = {
  totalDailyAchievements: number;
  existingScoreEvents: number;
  pendingScoreEvents: number;
  createdScoreEvents: number;
};

/**
 * Backfills DailyAchievement aggregates as explicitly labelled opening-balance
 * score events. A legacy aggregate cannot be truthfully split into individual
 * actions, so each source row becomes exactly one historical event with a
 * stable idempotency key. This is additive and never alters the legacy row.
 */
export const scoreEventMigrationService = {
  async syncDailyAchievementById(id: string) {
    const achievement = await prisma.dailyAchievement.findUnique({ where: { id } });
    if (!achievement) throw new Error("DailyAchievement not found");
    const reference = `DailyAchievement:${achievement.id}`;
    const event = await prisma.scoreEvent.findFirst({ where: { externalReference: reference, voidedAt: null }, orderBy: { createdAt: "desc" } });
    const matches = event && event.quantity === achievement.value && event.points === achievement.points
      && event.podId === achievement.podId && event.ruleName === achievement.ruleName
      && event.scoredForDate.getTime() === achievement.date.getTime()
      && (event.recordedAt?.getTime() ?? null) === (achievement.loggedAt?.getTime() ?? null);
    if (matches) return event;
    if (event) {
      await prisma.scoreEvent.update({ where: { id: event.id }, data: { voidedAt: new Date(), voidedById: "daily-achievement-sync", voidReason: "Daily aggregate changed during score-event transition" } });
      competitionSseService.broadcast(achievement.competitionId, {
        type: "score_event_voided",
        data: { competitionId: achievement.competitionId, eventId: event.id },
        timestamp: new Date().toISOString(),
      });
    }
    const created = await prisma.scoreEvent.create({ data: {
      competitionId: achievement.competitionId, ruleId: achievement.ruleId, ruleName: achievement.ruleName,
      subjectAgentId: achievement.agentId, podId: achievement.podId, quantity: achievement.value, points: achievement.points,
      scoredForDate: achievement.date, source: "migration", recordedAt: achievement.loggedAt,
      correctionOfId: event?.id ?? null, externalReference: reference,
      idempotencyKey: `legacy-daily-achievement-sync:${achievement.id}:${achievement.value}:${achievement.points}:${achievement.loggedAt?.getTime() ?? "none"}`,
    } });
    competitionSseService.broadcast(achievement.competitionId, {
      type: "score_event_recorded",
      data: { competitionId: achievement.competitionId, eventId: created.id },
      timestamp: new Date().toISOString(),
    });
    return created;
  },

  async syncDailyAchievementCorrections(input: { apply: boolean }) {
    const achievements = await prisma.dailyAchievement.findMany({
      select: { id: true, competitionId: true, ruleId: true, ruleName: true, agentId: true, podId: true, value: true, points: true, date: true, loggedAt: true },
    });
    const references = achievements.map((achievement) => `DailyAchievement:${achievement.id}`);
    const events = references.length ? await prisma.scoreEvent.findMany({
      where: { externalReference: { in: references }, voidedAt: null },
      orderBy: { createdAt: "desc" },
    }) : [];
    const activeByReference = new Map(events.map((event) => [event.externalReference, event]));
    const changes = achievements.flatMap((achievement) => {
      const reference = `DailyAchievement:${achievement.id}`;
      const event = activeByReference.get(reference);
      const different = !event || event.quantity !== achievement.value || event.points !== achievement.points
        || event.podId !== achievement.podId || event.ruleName !== achievement.ruleName
        || event.scoredForDate.getTime() !== achievement.date.getTime()
        || (event.recordedAt?.getTime() ?? null) !== (achievement.loggedAt?.getTime() ?? null);
      return different ? [{ achievement, event, reference }] : [];
    });

    if (input.apply) {
      for (const { achievement, event, reference } of changes) {
        if (event) {
          await prisma.scoreEvent.update({
            where: { id: event.id },
            data: { voidedAt: new Date(), voidedById: "migration-sync", voidReason: "Legacy DailyAchievement changed before score-event cutover" },
          });
        }
        await prisma.scoreEvent.create({
          data: {
            competitionId: achievement.competitionId, ruleId: achievement.ruleId, ruleName: achievement.ruleName,
            subjectAgentId: achievement.agentId, podId: achievement.podId, quantity: achievement.value, points: achievement.points,
            scoredForDate: achievement.date, source: "migration", recordedAt: achievement.loggedAt,
            correctionOfId: event?.id ?? null, externalReference: reference,
            idempotencyKey: `legacy-daily-achievement-sync:${achievement.id}:${achievement.value}:${achievement.points}:${achievement.loggedAt?.getTime() ?? "none"}`,
          },
        });
      }
    }
    return { changedDailyAchievements: changes.length, appliedCorrections: input.apply ? changes.length : 0 };
  },

  async backfillDailyAchievements(input: { apply: boolean }): Promise<DailyAchievementBackfillResult> {
    const achievements = await prisma.dailyAchievement.findMany({
      select: {
        id: true,
        competitionId: true,
        ruleId: true,
        ruleName: true,
        agentId: true,
        podId: true,
        value: true,
        points: true,
        date: true,
        loggedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const keys = achievements.map((achievement) => `legacy-daily-achievement:${achievement.id}`);
    const existing = keys.length
      ? await prisma.scoreEvent.findMany({
          where: { idempotencyKey: { in: keys } },
          select: { idempotencyKey: true },
        })
      : [];
    const existingKeys = new Set(existing.flatMap((event) => event.idempotencyKey ? [event.idempotencyKey] : []));
    const pending = achievements.filter(
      (achievement) => !existingKeys.has(`legacy-daily-achievement:${achievement.id}`),
    );

    let createdScoreEvents = 0;
    if (input.apply && pending.length) {
      const result = await prisma.scoreEvent.createMany({
        data: pending.map((achievement) => ({
          competitionId: achievement.competitionId,
          ruleId: achievement.ruleId,
          ruleName: achievement.ruleName,
          subjectAgentId: achievement.agentId,
          podId: achievement.podId,
          quantity: achievement.value,
          points: achievement.points,
          scoredForDate: achievement.date,
          source: "migration",
          recordedAt: achievement.loggedAt,
          idempotencyKey: `legacy-daily-achievement:${achievement.id}`,
          externalReference: `DailyAchievement:${achievement.id}`,
        })),
        skipDuplicates: true,
      });
      createdScoreEvents = result.count;
    }

    return {
      totalDailyAchievements: achievements.length,
      existingScoreEvents: existing.length,
      pendingScoreEvents: pending.length,
      createdScoreEvents,
    };
  },
};
