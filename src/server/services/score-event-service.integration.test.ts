import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "@/server/db/client";
import { scoreEventService } from "./score-event-service";

test("score events are idempotent, total active points, and remain auditable after voiding", async (t) => {
  const fixtureId = randomUUID();
  const competitionId = `score-event-test-competition-${fixtureId}`;
  const agentId = `score-event-test-agent-${fixtureId}`;
  const date = new Date("2026-07-18T00:00:00.000Z");

  t.after(async () => {
    await prisma.scoreEvent.deleteMany({ where: { competitionId } });
  });

  const original = await scoreEventService.record({
    competitionId,
    ruleId: `score-event-test-rule-${fixtureId}`,
    ruleName: "Test rule",
    subjectAgentId: agentId,
    podId: `score-event-test-pod-${fixtureId}`,
    quantity: 2,
    points: 10,
    scoredForDate: date,
    source: "manager",
    recordedById: `score-event-test-manager-${fixtureId}`,
    idempotencyKey: `score-event-test-key-${fixtureId}`,
  });

  const repeated = await scoreEventService.record({
    competitionId,
    ruleId: `score-event-test-rule-${fixtureId}`,
    ruleName: "Test rule",
    subjectAgentId: agentId,
    podId: `score-event-test-pod-${fixtureId}`,
    quantity: 2,
    points: 10,
    scoredForDate: date,
    source: "manager",
    recordedById: `score-event-test-manager-${fixtureId}`,
    idempotencyKey: `score-event-test-key-${fixtureId}`,
  });

  assert.equal(repeated.id, original.id);
  assert.equal(await scoreEventService.getCompetitionTotal({ competitionId }), 10);
  assert.equal(await scoreEventService.getCompetitionTotal({ competitionId, subjectAgentId: agentId }), 10);

  const voided = await scoreEventService.void({
    eventId: original.id,
    voidedById: `score-event-test-manager-${fixtureId}`,
    reason: "Entered in error",
  });

  assert.equal(voided.id, original.id);
  assert.ok(voided.voidedAt);
  assert.equal(voided.voidReason, "Entered in error");
  assert.equal(await scoreEventService.getCompetitionTotal({ competitionId }), 0);
  assert.equal(await prisma.scoreEvent.count({ where: { id: original.id } }), 1);

  await assert.rejects(
    scoreEventService.void({
      eventId: original.id,
      voidedById: `score-event-test-manager-${fixtureId}`,
      reason: "Second attempt",
    }),
    /already been voided/,
  );
});

test("score corrections require a meaningful reason", async () => {
  await assert.rejects(
    scoreEventService.void({ eventId: "not-used", voidedById: "manager", reason: "   " }),
    /void reason is required/,
  );
});
