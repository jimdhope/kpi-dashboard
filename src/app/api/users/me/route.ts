import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { userService } from "@/server/services/user-service";

const schema = z.object({
  name: z.string().min(2).max(80),
});

export async function GET() {
  try {
    return ok({ user: await userService.getCurrentUser() });
  } catch {
    return errorResponse(401, "Unauthorized");
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    await authService.requireCurrentUser();

    const updatedUser = await userService.updateCurrentProfile({
      name: payload.name,
    });

    return ok(updatedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid profile payload.");
    }

    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }

    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }

    return errorResponse(500, "Failed to update profile.");
  }
}
