import { NextRequest } from "next/server";
import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authService.requireAdmin();
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.badge.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse(404, "Badge not found");
    }

    const badge = await prisma.badge.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        description: body.description ?? existing.description,
        icon: body.icon ?? existing.icon,
        iconType: body.iconType ?? existing.iconType,
        scope: body.scope ?? existing.scope,
        criteria: body.criteria !== undefined ? body.criteria : existing.criteria,
        rankTinted: body.rankTinted ?? existing.rankTinted,
        isActive: body.isActive ?? existing.isActive,
        sortOrder: body.sortOrder ?? existing.sortOrder,
      },
    });

    return ok({ badge });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    return errorResponse(500, "Failed to update badge.");
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authService.requireAdmin();
    const { id } = await params;

    const existing = await prisma.badge.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse(404, "Badge not found");
    }

    await prisma.agentBadge.deleteMany({ where: { badgeId: id } });
    await prisma.badge.delete({ where: { id } });

    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    return errorResponse(500, "Failed to delete badge.");
  }
}
