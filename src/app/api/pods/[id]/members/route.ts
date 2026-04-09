import { authService } from "@/server/services/auth-service";
import { errorResponse, ok } from "@/server/http";
import { prisma } from "@/server/db/client";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await authService.requireCurrentUser();
    const memberships = await prisma.podMembership.findMany({
      where: { podId: id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    const members = memberships
      .map((m) => m.user)
      .sort((a, b) => a.name.localeCompare(b.name));
    return ok(members);
  } catch {
    return errorResponse(401, "Unauthorized");
  }
}
