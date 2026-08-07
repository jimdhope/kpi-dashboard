import { authService } from '@/server/services/auth-service';
import { permissionService } from '@/server/services/permission-service';
import { memeMatchService } from '@/server/services/meme-match-service';
import { errorResponse, ok } from '@/server/http';

export async function GET() {
  try {
    const user = await authService.requireCurrentUser();
    if (!(await permissionService.hasEffectiveAdminAccess(user.roles))) throw new Error('Forbidden');
    return ok({ rooms: await memeMatchService.getActiveRooms() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load active rooms';
    return errorResponse(message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 400, message);
  }
}
