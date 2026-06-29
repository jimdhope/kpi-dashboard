import { prisma } from "@/server/db/client";
import { scoreTargetRepository } from "@/server/repositories/score-target-repository";

interface ParsedHashtag {
  hashtag: string;
  multiplier: number;
  value?: number;
}

function parseHashtags(text: string): ParsedHashtag[] {
  const results: ParsedHashtag[] = [];
  const regex = /#(\w+)(?:\s+(?:x\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)))?/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const hashtag = match[1].toLowerCase();
    let multiplier = 1;

    if (match[2]) {
      multiplier = parseFloat(match[2]);
    } else if (match[3]) {
      multiplier = parseFloat(match[3]);
    }

    results.push({ hashtag, multiplier });
  }

  return results;
}

function extractUserEmail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.from === "object" && record.from !== null) {
    const from = record.from as Record<string, unknown>;
    if (typeof from.email === "string") {
      return from.email.toLowerCase();
    }
  }

  if (typeof record.from === "string") {
    const emailMatch = record.from.match(/<(.+)>/);
    if (emailMatch) {
      return emailMatch[1].toLowerCase();
    }
    if (record.from.includes("@")) {
      return (record.from as string).toLowerCase();
    }
  }

  if (typeof record.sender === "object" && record.sender !== null) {
    const sender = record.sender as Record<string, unknown>;
    if (typeof sender.email === "string") {
      return sender.email.toLowerCase();
    }
  }

  return null;
}

function extractMessageText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.text === "string") {
    return record.text;
  }

  if (typeof record.body === "object" && record.body !== null) {
    const body = record.body as Record<string, unknown>;
    if (typeof body.content === "string") {
      return body.content;
    }
  }

  if (typeof record.content === "string") {
    return record.content;
  }

  return "";
}

export const scoreTargetService = {
  async listTargets() {
    return scoreTargetRepository.list();
  },

  async createTarget(input: {
    hashtag: string;
    name: string;
    targetType: "competition" | "tracker";
    competitionId?: string | null;
    trackerKpiId?: string | null;
    defaultPoints?: number;
  }) {
    if (!input.hashtag.startsWith("#")) {
      input.hashtag = "#" + input.hashtag;
    }
    return scoreTargetRepository.create(input);
  },

  async updateTarget(
    id: string,
    input: {
      hashtag?: string;
      name?: string;
      targetType?: "competition" | "tracker";
      competitionId?: string | null;
      trackerKpiId?: string | null;
      defaultPoints?: number;
      isActive?: boolean;
    }
  ) {
    if (input.hashtag && !input.hashtag.startsWith("#")) {
      input.hashtag = "#" + input.hashtag;
    }
    return scoreTargetRepository.update(id, input);
  },

  async deleteTarget(id: string) {
    return scoreTargetRepository.delete(id);
  },

  async processWebhookMessage(
    payload: unknown,
    endpointId: string
  ): Promise<{ processed: number; results: Array<{ hashtag: string; success: boolean; error?: string }> }> {
    const messageText = extractMessageText(payload);
    const userEmail = extractUserEmail(payload);

    if (!userEmail) {
      return {
        processed: 0,
        results: [{ hashtag: "", success: false, error: "Could not identify user from message" }],
      };
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return {
        processed: 0,
        results: [{ hashtag: "", success: false, error: `User not found: ${userEmail}` }],
      };
    }

    const hashtags = parseHashtags(messageText);
    const results: Array<{ hashtag: string; success: boolean; error?: string }> = [];

    for (const parsed of hashtags) {
      try {
        const target = await scoreTargetRepository.findByHashtag(parsed.hashtag);

        if (!target) {
          results.push({ hashtag: parsed.hashtag, success: false, error: "Hashtag not configured" });
          continue;
        }

        if (!target.isActive) {
          results.push({ hashtag: parsed.hashtag, success: false, error: "Hashtag is disabled" });
          continue;
        }

        const points = parsed.multiplier * target.defaultPoints;

        if (target.targetType === "competition" && target.competitionId) {
          const now = new Date();
          const competition = await prisma.competition.findUnique({
            where: { id: target.competitionId },
          });

          if (!competition || !competition.startsAt || !competition.endsAt) {
            results.push({ hashtag: parsed.hashtag, success: false, error: "Competition not found or invalid dates" });
            continue;
          }

          if (now < competition.startsAt || now > competition.endsAt) {
            results.push({ hashtag: parsed.hashtag, success: false, error: "Competition is not active" });
            continue;
          }

          let entry = await prisma.competitionEntry.findFirst({
            where: { competitionId: target.competitionId, userId: user.id },
          });

          if (!entry) {
            entry = await prisma.competitionEntry.create({
              data: { competitionId: target.competitionId, userId: user.id, score: 0 },
            });
          }

          await prisma.competitionScoreLog.create({
            data: {
              entryId: entry.id,
              ruleId: target.id,
              value: points,
              isBonus: false,
            },
          });

          await prisma.competitionEntry.update({
            where: { id: entry.id },
            data: { score: { increment: points } },
          });

          results.push({ hashtag: parsed.hashtag, success: true });
        } else if (target.targetType === "tracker" && target.trackerKpiId) {
          await prisma.trackerLog.create({
            data: {
              trackerKpiId: target.trackerKpiId,
              userId: user.id,
              value: points,
            },
          });

          results.push({ hashtag: parsed.hashtag, success: true });
        } else {
          results.push({ hashtag: parsed.hashtag, success: false, error: "Target not properly configured" });
        }
      } catch (error) {
        results.push({
          hashtag: parsed.hashtag,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      processed: results.filter((r) => r.success).length,
      results,
    };
  },
};