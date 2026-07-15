"use server";

import { authService } from "@/server/services/auth-service";
import { rpsService } from "@/server/services/rps-service";

export async function playRps(playerThrow: unknown) {
  const user = await authService.requireCurrentUser();
  const { game, cooldownSeconds } = await rpsService.play(user, playerThrow);
  return {
    playerThrow: game.playerThrow,
    opponentThrow: game.opponentThrow,
    result: game.result,
    cooldownSeconds,
  };
}

export async function getRpsDailyStats() {
  return { wins: 0, losses: 0, draws: 0 };
}

export async function getRpsPodStandings() {
  return [];
}
