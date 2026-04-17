import { z } from "zod";
import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { getRoleBasedDashboard } from "@/lib/contracts";

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
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
