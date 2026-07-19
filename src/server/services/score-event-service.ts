import "server-only";

import { scoreEventRepository, type ScoreEventRecord } from "@/server/repositories/score-event-repository";
import { competitionSseService } from "@/server/services/competition-sse-service";
import { notificationService } from "@/server/services/notification-service";

export const SCORE_EVENT_SOURCES = [
  "agent_dashboard",
  "manager",
  "mobile",
  "teams",
  "migration",
] as const;

export type ScoreEventSource = (typeof SCORE_EVENT_SOURCES)[number];

type RecordScoreEventInput = {
  competitionId: string;
  ruleId: string;
  ruleName?: string | null;
  subjectAgentId: string;
  podId: string;
  quantity: number;
  points: number;
  scoredForDate: Date;
  source: ScoreEventSource;
  recordedAt?: Date | null;
  recordedById?: string | null;
  idempotencyKey?: string | null;
  externalReference?: string | null;
  correctionOfId?: string | null;
};

/**
 * Canonical score-event domain service. HTTP boundaries must authenticate and
 * enforce competition scope before calling this service.
 */
export const scoreEventService = {
  async record(input: RecordScoreEventInput): Promise<ScoreEventRecord> {
    if (!Number.isInteger(input.quantity) || input.quantity === 0) {
      throw new Error("Score event quantity must be a non-zero integer.");
    }

    if (!input.podId.trim()) {
      throw new Error("Score event podId is required.");
    }

    if (!Number.isInteger(input.points)) {
      throw new Error("Score event points must be an integer.");
    }

    if (Number.isNaN(input.scoredForDate.getTime())) {
      throw new Error("Score event scoredForDate must be a valid date.");
    }

    if (input.idempotencyKey) {
      const existing = await scoreEventRepository.findByIdempotencyKey(input.idempotencyKey);
      if (existing) return existing;
    }

    const event = await scoreEventRepository.create({
      ...input,
      ruleName: input.ruleName ?? null,
      recordedAt: input.recordedAt ?? new Date(),
      recordedById: input.recordedById ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      externalReference: input.externalReference ?? null,
      correctionOfId: input.correctionOfId ?? null,
    });
    competitionSseService.broadcast(event.competitionId, {
      type: "score_event_recorded",
      data: { competitionId: event.competitionId, eventId: event.id },
      timestamp: new Date().toISOString(),
    });
    return event;
  },

  async void(input: {
    eventId: string;
    voidedById: string;
    reason: string;
  }): Promise<ScoreEventRecord> {
    const reason = input.reason.trim();
    if (!reason) throw new Error("A void reason is required.");

    const event = await scoreEventRepository.void({
      id: input.eventId,
      voidedById: input.voidedById,
      voidReason: reason,
      voidedAt: new Date(),
    });

    if (!event) throw new Error("Score event was not found or has already been voided.");
    if (event.subjectAgentId !== input.voidedById) {
      try {
        await notificationService.create({
          recipientId: event.subjectAgentId,
          type: "SCORE_CORRECTED",
          title: "A competition score was corrected",
          message: `${event.ruleName || "A score"} was removed: ${reason}`,
          href: "/agent/competitions",
        });
      } catch (notificationError) {
        console.error("Score correction notification failed:", notificationError);
      }
    }
    competitionSseService.broadcast(event.competitionId, {
      type: "score_event_voided",
      data: { competitionId: event.competitionId, eventId: event.id },
      timestamp: new Date().toISOString(),
    });
    return event;
  },

  async getCompetitionTotal(input: {
    competitionId: string;
    subjectAgentId?: string;
    start?: Date;
    end?: Date;
  }): Promise<number> {
    const events = await scoreEventRepository.findActiveByCompetition({
      competitionId: input.competitionId,
      scoredForDate: { gte: input.start, lte: input.end },
    });

    return events
      .filter((event) => !input.subjectAgentId || event.subjectAgentId === input.subjectAgentId)
      .reduce((total, event) => total + event.points, 0);
  },
};
