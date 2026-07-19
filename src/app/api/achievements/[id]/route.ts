import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";
import { requireCompetitionScoreLogger } from "@/server/services/authorization";
import { scoreEventService } from "@/server/services/score-event-service";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const event = await prisma.scoreEvent.findUnique({ where: { id } });
    if (!event || event.voidedAt) return errorResponse(404, "Achievement not found.");
    const user = await requireCompetitionScoreLogger({ competitionId: event.competitionId, podId: event.podId });
    await scoreEventService.void({ eventId: id, voidedById: user.id, reason: "Deleted from score log" });
    if (event.externalReference?.startsWith("DailyAchievement:")) {
      const dailyAchievementId = event.externalReference.slice("DailyAchievement:".length);
      await prisma.dailyAchievement.delete({ where: { id: dailyAchievementId } }).catch(() => null);
    }
    return ok({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    console.error('DELETE /api/achievements/[id] error:', error);
    return errorResponse(500, "Failed to delete achievement.");
  }
}
