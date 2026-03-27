import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
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

    return ok({ games });
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

    return ok({ game }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid game payload.");
    }
    console.error('POST /api/rps-games error:', error);
    return errorResponse(500, "Failed to create game.");
  }
}
