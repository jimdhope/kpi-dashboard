import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";
import { requireCompetitionScoreLogger } from "@/server/services/authorization";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireCompetitionScoreLogger();
    await prisma.dailyAchievement.delete({
      where: { id },
    });
    return ok({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    console.error('DELETE /api/achievements/[id] error:', error);
    return errorResponse(500, "Failed to delete achievement.");
  }
}
