import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await authService.requireCurrentUser();
    await prisma.dailyAchievement.delete({
      where: { id: params.id },
    });
    return ok({ success: true });
  } catch (error) {
    console.error('DELETE /api/achievements/[id] error:', error);
    return errorResponse(500, "Failed to delete achievement.");
  }
}
