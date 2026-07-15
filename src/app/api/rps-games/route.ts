import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";
import { RpsCooldownError, rpsService } from "@/server/services/rps-service";

const createSchema = z.object({
  playerThrow: z.enum(['rock', 'paper', 'scissors']),
});

export async function GET(request: Request) {
  try {
    await authService.requireCurrentUser();
    const url = new URL(request.url);
    const requestedLimit = Number.parseInt(url.searchParams.get('limit') || '100', 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 100;

    const games = await prisma.rpsGame.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const leaderboard = await rpsService.leaderboard();

    return ok({ games, leaderboard });
  } catch (error) {
    console.error('GET /api/rps-games error:', error);
    return errorResponse(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    const session = await authService.getCurrentSession();
    if (!session.user) return errorResponse(401, "Unauthorized");
    const payload = createSchema.parse(await request.json());
    const result = await rpsService.play(session.user, payload.playerThrow);
    return ok(result, { status: 201 });
  } catch (error) {
    if (error instanceof RpsCooldownError) {
      return Response.json(
        { error: error.message, retryAfterSeconds: error.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid game payload.");
    }
    console.error('POST /api/rps-games error:', error);
    return errorResponse(500, "Failed to create game.");
  }
}
