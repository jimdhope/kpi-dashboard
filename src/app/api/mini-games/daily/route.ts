import { authService } from '@/server/services/auth-service';
import { dailyGameService } from '@/server/services/daily-game-service';
import { errorResponse, ok } from '@/server/http';

export async function GET() {
  try {
    const user = await authService.requireCurrentUser();
    return ok({ games: await dailyGameService.summaries(user.id) });
  } catch (error) {
    return errorResponse(401, error instanceof Error ? error.message : 'Unauthorized');
  }
}
