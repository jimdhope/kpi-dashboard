import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";

export async function GET() {
  try {
    const session = await authService.getCurrentSession();
    if (!session) {
      return errorResponse(401, "Unauthorized");
    }

    const memberships = await prisma.podMembership.findMany({
      select: {
        userId: true,
        podId: true,
      },
    });

    return ok({ memberships });
  } catch (error) {
    console.error("GET /api/pod-memberships error:", error);
    return errorResponse(500, "Failed to fetch memberships");
  }
}