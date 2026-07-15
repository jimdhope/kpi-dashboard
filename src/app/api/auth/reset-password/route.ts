import { z } from "zod";
import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { consumeRateLimit, privateRateLimitKey, requestClientKey } from "@/server/security/rate-limit";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const rate = consumeRateLimit(
      `reset:${requestClientKey(request)}:${privateRateLimitKey(body.token)}`,
      { limit: 5, windowMs: 60 * 60 * 1000 },
    );
    if (!rate.allowed) {
      return errorResponse(429, "Too many reset attempts. Please try again later.");
    }
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
