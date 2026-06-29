import { z } from "zod";
import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    await authService.resetPassword(body.token, body.password);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid payload. Password must be at least 8 characters.");
    }
    const message = error instanceof Error ? error.message : "Failed to reset password.";
    return errorResponse(400, message);
  }
}
