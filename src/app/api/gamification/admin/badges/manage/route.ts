import { NextRequest } from "next/server";
import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";

export async function GET() {
  try {
    await authService.requireAdmin();
    const badges = await prisma.badge.findMany({ orderBy: { sortOrder: "asc" } });
    return ok({ badges });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    return errorResponse(500, "Failed to fetch badges.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await authService.requireAdmin();
    const body = await request.json();
    const { key, name, description, icon, iconType, scope, criteria, rankTinted, isActive, sortOrder } = body;

    if (!key || !name) {
      return errorResponse(400, "key and name are required");
    }

    const existing = await prisma.badge.findUnique({ where: { key } });
    if (existing) {
      return errorResponse(409, "A badge with this key already exists");
    }

    const badge = await prisma.badge.create({
      data: {
        key,
        name,
        description: description ?? "",
        icon: icon ?? "🏆",
        iconType: iconType ?? "emoji",
        scope: scope ?? "COMPETITION",
        criteria: criteria ?? null,
        rankTinted: rankTinted ?? false,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });

    return ok({ badge });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    return errorResponse(500, "Failed to create badge.");
  }
}
