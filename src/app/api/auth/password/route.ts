import { z } from "zod";
import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const user = await authService.requireCurrentUser();
    const body = schema.parse(await request.json());
    await authService.changePassword(user.id, body.currentPassword, body.newPassword);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid payload. Password must be at least 8 characters.");
    }
    const message = error instanceof Error ? error.message : "Failed to change password.";
    return errorResponse(400, message);
  }
}
