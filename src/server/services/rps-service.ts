import { randomInt } from "node:crypto";
import { z } from "zod";
import type { AppUser } from "@/lib/contracts";
import { prisma } from "@/server/db/client";
import { activityService } from "@/server/services/activity-service";

const throwSchema = z.enum(["rock", "paper", "scissors"]);
const throws = throwSchema.options;
const cooldownMs = 15 * 60 * 1000;

export class RpsCooldownError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Rock Paper Scissors is still on cooldown.");
    this.name = "RpsCooldownError";
  }
}

function calculateResult(player: z.infer<typeof throwSchema>, opponent: z.infer<typeof throwSchema>) {
  if (player === opponent) return "draw" as const;
  if (
    (player === "rock" && opponent === "scissors") ||
    (player === "scissors" && opponent === "paper") ||
    (player === "paper" && opponent === "rock")
  ) {
    return "win" as const;
  }
  return "loss" as const;
}

export const rpsService = {
  async leaderboard() {
    const topPlayers = await prisma.rpsGame.groupBy({
      by: ["playerId"],
      where: { result: "win" },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 50,
    });
    const players = await prisma.user.findMany({
      where: { id: { in: topPlayers.map((entry) => entry.playerId) } },
      select: { id: true, name: true, email: true },
    });
    const playerDetails = new Map(players.map((player) => [player.id, player]));

    return topPlayers
      .map((entry) => {
        const player = playerDetails.get(entry.playerId);
        return {
          userId: entry.playerId,
          name: player?.name || "Unknown",
          score: entry._count.id,
          email: player?.email,
        };
      })
      .filter((entry) => !entry.email?.toLowerCase().endsWith("@test.com"))
      .slice(0, 10)
      .map(({ email: _email, ...entry }, index) => ({ ...entry, rank: index + 1 }));
  },

  async play(user: AppUser, input: unknown) {
    const playerThrow = throwSchema.parse(input);
    const opponentThrow = throws[randomInt(throws.length)];
    const result = calculateResult(playerThrow, opponentThrow);

    const game = await prisma.$transaction(async (tx) => {
      // Serialize plays per user so simultaneous requests cannot bypass cooldown.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
      const latest = await tx.rpsGame.findFirst({
        where: { playerId: user.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      if (latest) {
        const availableAt = latest.createdAt.getTime() + cooldownMs;
        if (availableAt > Date.now()) {
          throw new RpsCooldownError(Math.ceil((availableAt - Date.now()) / 1000));
        }
      }

      return tx.rpsGame.create({
        data: {
          playerId: user.id,
          playerThrow,
          opponentThrow,
          result,
          points: 0,
        },
      });
    });

    try {
      if (result === "win") {
        await activityService.logGameWon({
          gameId: game.id,
          gameName: "Rock Paper Scissors",
          score: game.points,
          userId: user.id,
          userName: user.name,
        });
      } else {
        await activityService.logGamePlayed({
          gameId: game.id,
          gameName: "Rock Paper Scissors",
          result,
          score: game.points,
          userId: user.id,
          userName: user.name,
        });
      }
    } catch (error) {
      // The scored game is authoritative. A secondary activity-feed failure
      // must not invite a retry that can only be rejected by cooldown.
      console.error("Failed to record RPS activity", {
        gameId: game.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return { game, cooldownSeconds: cooldownMs / 1000 };
  },
};
