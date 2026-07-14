import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { activityService } from "@/server/services/activity-service";
import { prisma } from "@/server/db/client";

const createSchema = z.object({
  playerThrow: z.enum(['rock', 'paper', 'scissors']),
  opponentThrow: z.enum(['rock', 'paper', 'scissors']),
  result: z.enum(['win', 'loss', 'draw']),
  points: z.number().int().optional(),
});

export async function GET(request: Request) {
  try {
    await authService.requireCurrentUser();
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');

    const games = await prisma.rpsGame.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const topPlayers = await prisma.rpsGame.groupBy({
      by: ['playerId'],
      where: { result: 'win' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 50,
    });
    const players = await prisma.user.findMany({
      where: { id: { in: topPlayers.map((entry) => entry.playerId) } },
      select: { id: true, name: true, email: true },
    });
    const playerDetails = new Map(players.map((player) => [player.id, player]));
    const leaderboard = topPlayers
      .map((entry) => {
        const player = playerDetails.get(entry.playerId);
        return {
          userId: entry.playerId,
          name: player?.name || 'Unknown',
          score: entry._count.id,
          email: player?.email,
        };
      })
      .filter((entry) => !entry.email?.toLowerCase().endsWith('@test.com'))
      .slice(0, 10)
      .map(({ email: _email, ...entry }, index) => ({ ...entry, rank: index + 1 }));

    return ok({ games, leaderboard });
  } catch (error) {
    console.error('GET /api/rps-games error:', error);
    return errorResponse(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    const user = await authService.requireCurrentUser();
    const payload = createSchema.parse(await request.json());

    const game = await prisma.rpsGame.create({
      data: {
        playerId: user.id,
        playerThrow: payload.playerThrow,
        opponentThrow: payload.opponentThrow,
        result: payload.result,
        points: payload.points ?? 0,
      },
    });

    // Log activity for game result
    if (payload.result === 'win') {
      await activityService.logGameWon({
        gameId: game.id,
        gameName: 'Rock Paper Scissors',
        score: payload.points ?? 0,
        userId: user.id,
        userName: user.name,
      });
    } else {
      await activityService.logGamePlayed({
        gameId: game.id,
        gameName: 'Rock Paper Scissors',
        result: payload.result,
        score: payload.points ?? 0,
        userId: user.id,
        userName: user.name,
      });
    }

    return ok({ game }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid game payload.");
    }
    console.error('POST /api/rps-games error:', error);
    return errorResponse(500, "Failed to create game.");
  }
}
