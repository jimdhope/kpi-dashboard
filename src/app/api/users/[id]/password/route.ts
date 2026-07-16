import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { userService } from "@/server/services/user-service";

const schema = z.object({ password: z.string().min(8).max(128) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { password } = schema.parse(await request.json());
    await userService.resetPassword(id, password);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Password must be between 8 and 128 characters.");
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    if (error instanceof Error) return errorResponse(400, error.message);
    return errorResponse(500, "Failed to reset password.");
  }
}
