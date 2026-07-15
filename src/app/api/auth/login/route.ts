import { z } from "zod";
import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { getRoleBasedDashboard } from "@/lib/contracts";
import { consumeRateLimit, privateRateLimitKey, requestClientKey } from "@/server/security/rate-limit";

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const rate = consumeRateLimit(
      `login:${requestClientKey(request)}:${privateRateLimitKey(body.email)}`,
      { limit: 10, windowMs: 15 * 60 * 1000 },
    );
    if (!rate.allowed) {
      return new Response(JSON.stringify({ error: "Too many login attempts. Please try again later." }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(rate.retryAfterSeconds) },
      });
    }
    const session = await authService.login(body.email, body.password);

    const redirectUrl = getRoleBasedDashboard(session.user.roles);

    return ok({
      user: session.user,
      expiresAt: session.expiresAt.toISOString(),
      redirectUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid login payload.");
    }

    return errorResponse(401, "Invalid email or password.");
  }
}
