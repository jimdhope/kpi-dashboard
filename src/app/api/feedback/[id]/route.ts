import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { requireResourceAccess } from "@/server/services/authorization";
import { prisma } from "@/server/db/client";

const schema = z.object({ status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireResourceAccess("nav.settings.feedback", "MANAGE");
    const { id } = await params;
    const { status } = schema.parse(await request.json());
    return ok({ feedback: await prisma.feedback.update({ where: { id }, data: { status } }) });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid feedback status.");
    return errorResponse(404, "Feedback not found.");
  }
}
