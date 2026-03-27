import { z } from "zod";
import { USER_ROLES } from "@/lib/contracts";
import { errorResponse, ok } from "@/server/http";
import { userService } from "@/server/services/user-service";

const schema = z.object({
  name: z.string().min(2).max(80),
  roles: z.array(z.enum(USER_ROLES)).min(1),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    return ok(await userService.updateUser(id, payload));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid user payload.");
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }

    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }

    return errorResponse(500, "Failed to update user.");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await userService.deleteUser(id);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }

    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }

    return errorResponse(500, "Failed to delete user.");
  }
}
