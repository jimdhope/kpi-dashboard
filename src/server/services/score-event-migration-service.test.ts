import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "@/server/db/client";
import { scoreEventMigrationService } from "./score-event-migration-service";

/**
 * Regression coverage for the additive-on-top score corruption bug:
 * repeatedly syncing a DailyAchievement (or a double-submit of the same edit)
 * must leave exactly ONE active score event, never a stack.
 */
async function makeAchievement(fixtureId: string, value: number, points: number, loggedAt: Date) {
  return prisma.dailyAchievement.create({
    data: {
      competitionId: `migration-test-competition-${fixtureId}`,
      agentId: `migration-test-agent-${fixtureId}`,
      podId: `migration-test-pod-${fixtureId}`,
      ruleId: `migration-test-rule-${fixtureId}`,
      ruleName: "Ask Bruce",
      value,
      points,
      date: new Date("2026-07-22T00:00:00.000Z"),
      loggedBy: `migration-test-manager-${fixtureId}`,
      loggedAt,
    },
  });
}

function activeEventsFor(competitionId: string) {
  return prisma.scoreEvent.findMany({
    where: { competitionId, voidedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

test("editing a DailyAchievement replaces the score event instead of stacking it", async (t) => {
  const fixtureId = randomUUID();
  const competitionId = `migration-test-competition-${fixtureId}`;
  t.after(async () => {
    await prisma.scoreEvent.deleteMany({ where: { competitionId } });
    await prisma.dailyAchievement.deleteMany({ where: { competitionId } });
  });

  const achievement = await makeAchievement(fixtureId, 1, 2, new Date("2026-07-22T08:58:00.000Z"));
  await scoreEventMigrationService.syncDailyAchievementById(achievement.id);
  assert.equal((await activeEventsFor(competitionId)).length, 1);

  // Simulate a flurry of edits (1 -> 2 -> 3 -> 4 -> 5 -> 6) as the UI would
  // send them, including the same value submitted twice in quick succession.
  let value = 1;
  for (const next of [2, 3, 4, 5, 6, 6]) {
    value = next;
    const points = next * 2;
    await prisma.dailyAchievement.update({
      where: { id: achievement.id },
      data: { value, points, loggedAt: new Date() },
    });
    await scoreEventMigrationService.syncDailyAchievementById(achievement.id);
  }

  const active = await activeEventsFor(competitionId);
  assert.equal(active.length, 1, "exactly one active score event should remain");
  assert.equal(active[0].quantity, 6);
  assert.equal(active[0].points, 12);
});

test("a concurrent double-call for the same value leaves exactly one active event", async (t) => {
  const fixtureId = randomUUID();
  const competitionId = `migration-test-competition-${fixtureId}`;
  t.after(async () => {
    await prisma.scoreEvent.deleteMany({ where: { competitionId } });
    await prisma.dailyAchievement.deleteMany({ where: { competitionId } });
  });

  const achievement = await makeAchievement(fixtureId, 4, 8, new Date("2026-07-22T13:29:00.000Z"));
  await scoreEventMigrationService.syncDailyAchievementById(achievement.id);

  // Two near-simultaneous syncs for the same unchanged value (a double-submit).
  await Promise.all([
    scoreEventMigrationService.syncDailyAchievementById(achievement.id),
    scoreEventMigrationService.syncDailyAchievementById(achievement.id),
  ]);

  const active = await activeEventsFor(competitionId);
  assert.equal(active.length, 1, "double-submit must not duplicate the event");
  assert.equal(active[0].quantity, 4);
  assert.equal(active[0].points, 8);
});
