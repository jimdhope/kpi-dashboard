import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { requireResourceAccess } from "@/server/services/authorization";
import { prisma } from "@/server/db/client";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(1_000),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireResourceAccess("nav.settings.announcements", "MANAGE");
    const { id } = await params;
    const payload = updateSchema.parse(await request.json());
    const announcement = await prisma.messageOfDay.update({
      where: { id },
      data: { title: payload.title, message: payload.message, expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null },
    });
    return ok({ announcement });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid announcement.");
    return errorResponse(404, "Announcement not found.");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireResourceAccess("nav.settings.announcements", "MANAGE");
    const { id } = await params;
    await prisma.messageOfDay.delete({ where: { id } });
    return ok({ success: true });
  } catch {
    return errorResponse(404, "Announcement not found.");
  }
}
