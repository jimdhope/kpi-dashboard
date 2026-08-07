import { z } from 'zod';
import { authService } from '@/server/services/auth-service';
import { permissionService } from '@/server/services/permission-service';
import { prisma } from '@/server/db/client';
import { errorResponse, ok } from '@/server/http';

const promptSchema = z.object({ text: z.string().trim().min(3).max(240), category: z.string().trim().max(60).nullable().optional(), isActive: z.boolean().optional() });

async function requireManage() {
  const user = await authService.requireCurrentUser();
  if (!(await permissionService.hasNavAccess(user.roles, 'miniGames', 'MANAGE'))) throw new Error('Forbidden');
  return user;
}

export async function GET() {
  try { await requireManage(); return ok({ prompts: await prisma.memeMatchPrompt.findMany({ orderBy: { createdAt: 'asc' } }) }); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unable to load prompts'; return errorResponse(message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 400, message); }
}

export async function POST(request: Request) {
  try { const user = await requireManage(); const input = promptSchema.parse(await request.json()); return ok({ prompt: await prisma.memeMatchPrompt.create({ data: { text: input.text, category: input.category || null, isActive: input.isActive ?? true, createdById: user.id } }) }, { status: 201 }); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unable to create prompt'; return errorResponse(message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 400, message); }
}
