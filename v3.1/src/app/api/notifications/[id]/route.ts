import { errorResponse, ok } from "@/server/http";
import { notificationService } from "@/server/services/notification-service";

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    await notificationService.delete(context.params.id);
    return ok({ success: true });
  } catch {
    return errorResponse(401, "Unauthorized");
  }
}
