"use server";

import { authService } from "@/server/services/auth-service";
import { activityService } from "@/server/services/activity-service";
import { RpsGameResult } from "@/lib/contracts";

const RPS_COOLDOWN_MINUTES = 15;

export async function playRps(playerThrow: "rock" | "paper" | "scissors") {
  const user = await authService.requireCurrentUser();

  const opponentThrow = (["rock", "paper", "scissors"] as const)[
    Math.floor(Math.random() * 3)
  ];

  const result = calculateRpsWinner(playerThrow, opponentThrow);

  // Log activity
  await activityService.logAgentAction({
    type: "game_played",
    title: `Played Rock Paper Scissors (${result.toUpperCase()})`,
    description: `Threw ${playerThrow} against opponent's ${opponentThrow}.`,
    metadata: {
      game: "rps",
      playerThrow,
      opponentThrow,
      result,
    },
  });

  return {
    playerThrow,
    opponentThrow,
    result,
    cooldownSeconds: RPS_COOLDOWN_MINUTES * 60,
  } as RpsGameResult;
}

function calculateRpsWinner(player: string, opponent: string): "win" | "loss" | "draw" {
  if (player === opponent) return "draw";
  if (
    (player === "rock" && opponent === "scissors") ||
    (player === "scissors" && opponent === "paper") ||
    (player === "paper" && opponent === "rock")
  ) {
    return "win";
  }
  return "loss";
}

export async function getRpsDailyStats() {
  return { wins: 0, losses: 0, draws: 0 };
}

export async function getRpsPodStandings() {
  return [];
}
