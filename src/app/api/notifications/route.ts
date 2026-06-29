import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { notificationService } from "@/server/services/notification-service";

export async function GET(request: Request) {
  try {
    const user = await authService.requireCurrentUser();
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const result = await notificationService.list(user.id, limit, offset);
    const unreadCount = await notificationService.getUnreadCount(user.id);

    return ok({ ...result, unreadCount });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    return errorResponse(500, "Failed to fetch notifications.");
  }
}
