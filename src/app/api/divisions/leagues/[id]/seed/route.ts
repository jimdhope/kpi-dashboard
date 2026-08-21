import { z } from "zod";
import { prisma } from "@/server/db/client";
import { errorResponse, ok } from "@/server/http";
import { requireResourceAccess } from "@/server/services/authorization";
import { commitSeasonSeed, previewSeasonSeed } from "@/server/services/division-seed-service";

const seedSchema = z.object({ commit: z.boolean().optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireResourceAccess("nav.competitions.manage", "MANAGE");
    const { id } = await params;
    const payload = seedSchema.parse(await request.json().catch(() => ({})));

    if (!payload.commit) {
      return ok(await previewSeasonSeed(id));
    }

    const preview = await commitSeasonSeed(id, user.id);
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "divisions.season.seeded",
        entityType: "League",
        entityId: id,
        payloadJson: {
          tiers: preview.tiers.map((tier) => ({
            division: tier.division,
            userIds: tier.players.map((player) => player.userId),
          })),
        },
      },
    });
    return ok(preview);
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid seed payload.");
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error && error.message === "League roster is empty") {
      return errorResponse(409, "League roster is empty.");
    }
    console.error("POST /api/divisions/leagues/[id]/seed error:", error);
    return errorResponse(500, "Failed to seed league divisions.");
  }
}
