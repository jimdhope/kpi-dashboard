import { z } from "zod";
import { NOTIFICATION_PRIORITIES, NOTIFICATION_TYPES } from "@/lib/contracts";
import { errorResponse, ok } from "@/server/http";
import { notificationService } from "@/server/services/notification-service";

const schema = z.object({
  userId: z.string().min(1),
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string().min(1).max(120),
  message: z.string().min(1).max(2000),
  priority: z.enum(NOTIFICATION_PRIORITIES),
  actionUrl: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export async function GET() {
  try {
    return ok(await notificationService.listCurrentUserNotifications());
  } catch {
    return errorResponse(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    return ok(await notificationService.createNotification(payload), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid notification payload.");
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }

    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }

    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }

    return errorResponse(500, "Failed to create notification.");
  }
}
