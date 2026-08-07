import { z } from 'zod';
import { authService } from '@/server/services/auth-service';
import { permissionService } from '@/server/services/permission-service';
import { prisma } from '@/server/db/client';
import { errorResponse, ok } from '@/server/http';

const promptSchema = z.object({ text: z.string().trim().min(3).max(240), category: z.string().trim().max(60).nullable().optional(), isActive: z.boolean().optional() });
async function requireManage() { const user = await authService.requireCurrentUser(); if (!(await permissionService.hasNavAccess(user.roles, 'miniGames', 'MANAGE'))) throw new Error('Forbidden'); return user; }
function status(error: unknown) { const message = error instanceof Error ? error.message : 'Unable to update prompt'; return { message, code: message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 400 }; }

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { await requireManage(); const { id } = await context.params; const input = promptSchema.parse(await request.json()); return ok({ prompt: await prisma.memeMatchPrompt.update({ where: { id }, data: { text: input.text, category: input.category || null, ...(input.isActive === undefined ? {} : { isActive: input.isActive }) } }) }); }
  catch (error) { const result = status(error); return errorResponse(result.code, result.message); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { await requireManage(); const { id } = await context.params; await prisma.memeMatchPrompt.delete({ where: { id } }); return ok({ success: true }); }
  catch (error) { const result = status(error); return errorResponse(result.code, result.message); }
}
