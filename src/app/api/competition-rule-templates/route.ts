import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { prisma } from "@/server/db/client";
import { authService } from "@/server/services/auth-service";
import { requireCompetitionEditor } from "@/server/services/authorization";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  rules: z.array(
    z.object({
      title: z.string().min(1).max(120),
      points: z.number().int().min(0),
      isCheckbox: z.boolean().optional(),
      emoji: z.string().optional().nullable(),
      dailyTarget: z.number().int().optional().nullable(),
    })
  ),
});

export async function GET() {
  try {
    await authService.requireCurrentUser();
    
    const templates = await prisma.competitionRuleTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });
    
    return ok({ templates });
  } catch (error) {
    console.error("GET /api/competition-rule-templates error:", error);
    return errorResponse(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompetitionEditor();
    const body = await request.json();
    const payload = createSchema.parse(body);
    
    const template = await prisma.competitionRuleTemplate.create({
      data: {
        name: payload.name,
        description: payload.description,
        rules: payload.rules,
        createdById: user.id,
      },
    });
    
    return ok({ template }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid template payload.");
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    console.error("POST /api/competition-rule-templates error:", error);
    return errorResponse(500, "Failed to create template.");
  }
}
