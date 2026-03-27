import { errorResponse, ok } from "@/server/http";
import { notificationService } from "@/server/services/notification-service";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await notificationService.delete(id);
    return ok({ success: true });
  } catch {
    return errorResponse(401, "Unauthorized");
  }
}
