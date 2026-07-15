import { z } from "zod";
import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { consumeRateLimit, privateRateLimitKey, requestClientKey } from "@/server/security/rate-limit";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const rate = consumeRateLimit(
      `forgot:${requestClientKey(request)}:${privateRateLimitKey(body.email)}`,
      { limit: 5, windowMs: 60 * 60 * 1000 },
    );
    if (!rate.allowed) {
      // Keep the response indistinguishable from a successful request.
      return ok({ success: true });
    }
    await authService.forgotPassword(body.email);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid email address.");
    }
    return errorResponse(500, "Failed to send reset email.");
  }
}
