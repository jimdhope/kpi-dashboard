import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { notificationService } from "@/server/services/notification-service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authService.requireCurrentUser();
    const { id } = await params;
    await notificationService.markAsRead(id, user.id);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    return errorResponse(500, "Failed to mark notification as read.");
  }
}
