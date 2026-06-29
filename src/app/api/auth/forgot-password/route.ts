import { z } from "zod";
import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    await authService.forgotPassword(body.email);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid email address.");
    }
    return errorResponse(500, "Failed to send reset email.");
  }
}
