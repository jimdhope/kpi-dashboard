"use server";

import { authService } from "@/server/services/auth-service";
import { activityService } from "@/server/services/activity-service";
import { RpsGameResult } from "@/lib/contracts";
import { prisma } from "@/server/db/client";

const RPS_COOLDOWN_MINUTES = 15;
const GAME_ID = "rock-paper-scissors";
const GAME_NAME = "Rock Paper Scissors";

export async function playRps(playerThrow: "rock" | "paper" | "scissors") {
  const user = await authService.requireCurrentUser();

  const opponentThrow = (["rock", "paper", "scissors"] as const)[
    Math.floor(Math.random() * 3)
  ];

  const result = calculateRpsWinner(playerThrow, opponentThrow);

  // Log activity based on result
  if (result === 'win') {
    await activityService.logGameWon({
      gameId: GAME_ID,
      gameName: GAME_NAME,
      userId: user.id,
      userName: user.name,
    });
  } else {
    await activityService.logGamePlayed({
      gameId: GAME_ID,
      gameName: GAME_NAME,
      result,
      userId: user.id,
      userName: user.name,
    });
  }

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
