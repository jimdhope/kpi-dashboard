import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { prisma } from "@/server/db/client";
import { authService } from "@/server/services/auth-service";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  rules: z.array(
    z.object({
      title: z.string().min(1).max(120),
      points: z.number().int().min(0),
      isCheckbox: z.boolean().optional(),
      emoji: z.string().optional().nullable(),
      dailyTarget: z.number().int().optional().nullable(),
    })
  ).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await authService.requireCurrentUser();
    const { id } = await params;
    
    const template = await prisma.competitionRuleTemplate.findUnique({
      where: { id },
    });
    
    if (!template) {
      return errorResponse(404, "Template not found.");
    }
    
    return ok({ template });
  } catch (error) {
    console.error("GET /api/competition-rule-templates/[id] error:", error);
    return errorResponse(401, "Unauthorized");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await authService.requireCurrentUser();
    const { id } = await params;
    const body = await request.json();
    const payload = updateSchema.parse(body);
    
    const template = await prisma.competitionRuleTemplate.update({
      where: { id },
      data: {
        ...(payload.name && { name: payload.name }),
        ...(payload.description !== undefined && { description: payload.description }),
        ...(payload.rules && { rules: payload.rules }),
      },
    });
    
    return ok({ template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid template payload.");
    }
    console.error("PUT /api/competition-rule-templates/[id] error:", error);
    return errorResponse(500, "Failed to update template.");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await authService.requireCurrentUser();
    const { id } = await params;
    
    await prisma.competitionRuleTemplate.delete({
      where: { id },
    });
    
    return ok({ success: true });
  } catch (error) {
    console.error("DELETE /api/competition-rule-templates/[id] error:", error);
    return errorResponse(500, "Failed to delete template.");
  }
}
