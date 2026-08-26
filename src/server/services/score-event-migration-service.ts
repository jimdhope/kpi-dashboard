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
  /** Idempotency key for the synced score event of a DailyAchievement. Keyed on
   *  (achievement id, value, points) ONLY — NOT loggedAt — so a repeated sync
   *  for the same aggregate value dedupes instead of stacking duplicate events.
   *  A genuine value change produces a different key (the old event is voided). */
  dailyAchievementSyncKey(id: string, value: number, points: number): string {
    return `legacy-daily-achievement-sync:${id}:${value}:${points}`;
  },

  async syncDailyAchievementById(id: string) {
    const achievement = await prisma.dailyAchievement.findUnique({ where: { id } });
    if (!achievement) throw new Error("DailyAchievement not found");
    const reference = `DailyAchievement:${achievement.id}`;
    const idempotencyKey = this.dailyAchievementSyncKey(achievement.id, achievement.value, achievement.points);

    // 1. Already an active event for this exact aggregate value? `loggedAt` is
    //    cosmetic (when it was edited), not a scoring fact, so it is ignored
    //    when deciding whether the ledger already reflects this achievement.
    const active = await prisma.scoreEvent.findFirst({ where: { externalReference: reference, voidedAt: null }, orderBy: { createdAt: "desc" } });
    if (
      active &&
      active.quantity === achievement.value &&
      active.points === achievement.points &&
      active.podId === achievement.podId &&
      active.ruleName === achievement.ruleName &&
      active.scoredForDate.getTime() === achievement.date.getTime()
    ) {
      return active;
    }

    // 2. Void EVERY currently-active event for this achievement so the new one
    //    replaces (not adds to) the previous total.
    await prisma.scoreEvent.updateMany({
      where: { externalReference: reference, voidedAt: null },
      data: {
        voidedAt: new Date(),
        voidedById: "daily-achievement-sync",
        voidReason: "Daily aggregate changed during score-event transition",
      },
    });

    // 3. Create the replacement. A duplicate/racing call for the same value
    //    shares this key; if it beat us to the insert, swallow the unique
    //    violation and return the already-active event (exactly one survives).
    try {
      const created = await prisma.scoreEvent.create({
        data: {
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
          correctionOfId: null,
          externalReference: reference,
          idempotencyKey,
        },
      });
      competitionSseService.broadcast(achievement.competitionId, {
        type: "score_event_recorded",
        data: { competitionId: achievement.competitionId, eventId: created.id },
        timestamp: new Date().toISOString(),
      });
      return created;
    } catch (createError) {
      const survivor = await prisma.scoreEvent.findFirst({
        where: { externalReference: reference, voidedAt: null },
        orderBy: { createdAt: "desc" },
      });
      if (survivor) return survivor;
      throw createError;
    }
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
            idempotencyKey: scoreEventMigrationService.dailyAchievementSyncKey(achievement.id, achievement.value, achievement.points),
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
