import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { scoreEventService } from "@/server/services/score-event-service";
import { prisma } from "@/server/db/client";

/** Allows an agent to undo only their own self-recorded event. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authService.requireCurrentUser();
    const { id } = await params;
    const event = await prisma.scoreEvent.findUnique({ where: { id } });
    if (!event || event.voidedAt) return errorResponse(404, "Score event not found.");
    if (event.subjectAgentId !== user.id || event.source !== "agent_dashboard") {
      return errorResponse(403, "You can only undo your own self-recorded scores.");
    }
    await scoreEventService.void({ eventId: id, voidedById: user.id, reason: "Undone by agent" });
    return ok({ success: true });
  } catch (error) {
    console.error("DELETE /api/agent/score-events/[id] error:", error);
    return errorResponse(500, "Failed to undo score.");
  }
}
