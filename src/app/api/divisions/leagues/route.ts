import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { errorResponse, ok } from "@/server/http";
import { requireResourceAccess } from "@/server/services/authorization";
import { divisionRepository } from "@/server/repositories/division-repository";
import { getLeaguesOverview } from "@/server/services/division-view-service";

const createSchema = z
  .object({
    name: z.string().min(1).max(80),
    scopeType: z.enum(["POD", "CAMPAIGN"]),
    podId: z.string().optional(),
    campaignId: z.string().optional(),
    tierCount: z.number().int().min(2).max(3).optional(),
    configJson: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (value) => (value.scopeType === "POD" ? Boolean(value.podId) : Boolean(value.campaignId)),
    { message: "A pod or campaign must be selected for the league scope." },
  );

export async function GET() {
  try {
    await requireResourceAccess("nav.competitions.manage", "MANAGE");
    return ok(await getLeaguesOverview());
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    console.error("GET /api/divisions/leagues error:", error);
    return errorResponse(500, "Failed to load leagues.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireResourceAccess("nav.competitions.manage", "MANAGE");
    const payload = createSchema.parse(await request.json());

    if (payload.scopeType === "POD") {
      const existing = await prisma.league.findFirst({
        where: { scopeType: "POD", podId: payload.podId, isActive: true },
      });
      if (existing) return errorResponse(409, "An active league already exists for this pod.");
    } else {
      const existing = await prisma.league.findFirst({
        where: { scopeType: "CAMPAIGN", campaignId: payload.campaignId, isActive: true },
      });
      if (existing) return errorResponse(409, "An active league already exists for this campaign.");
    }

    const league = await divisionRepository.createLeague({
      name: payload.name,
      scopeType: payload.scopeType,
      podId: payload.podId ?? null,
      campaignId: payload.campaignId ?? null,
      tierCount: payload.tierCount ?? 3,
      configJson: payload.configJson
        ? (JSON.parse(JSON.stringify(payload.configJson)) as Prisma.InputJsonValue)
        : null,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "divisions.league.created",
        entityType: "League",
        entityId: league.id,
        payloadJson: { name: league.name, scopeType: league.scopeType },
      },
    });

    return ok(league);
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid league payload.");
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    console.error("POST /api/divisions/leagues error:", error);
    return errorResponse(500, "Failed to create league.");
  }
}
