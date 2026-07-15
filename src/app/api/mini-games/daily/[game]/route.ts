import { authService } from '@/server/services/auth-service';
import { dailyGameService, type DailyGameKey } from '@/server/services/daily-game-service';
import { errorResponse, ok } from '@/server/http';

const GAME_KEYS = new Set(['higher-lower', 'daily-word', 'sudoku']);

function parseGame(value: string): DailyGameKey {
  if (!GAME_KEYS.has(value)) throw new Error('Unknown game');
  return value as DailyGameKey;
}

export async function GET(request: Request, context: { params: Promise<{ game: string }> }) {
  try {
    const user = await authService.requireCurrentUser();
    const { game } = await context.params;
    const variant = new URL(request.url).searchParams.get('variant') || 'default';
    return ok(await dailyGameService.view(user.id, parseGame(game), variant));
  } catch (error) {
    return errorResponse(400, error instanceof Error ? error.message : 'Unable to load game');
  }
}

export async function POST(request: Request, context: { params: Promise<{ game: string }> }) {
  try {
    const user = await authService.requireCurrentUser();
    const { game } = await context.params;
    const body = await request.json();
    const variant = String(body.variant || 'default');
    return ok(await dailyGameService.act(user.id, parseGame(game), variant, body));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update game';
    return errorResponse(message === 'Unauthorized' ? 401 : 400, message);
  }
}
