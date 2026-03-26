import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { USER_ROLES } from "@/lib/contracts";
import { userService } from "@/server/services/user-service";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8),
  roles: z.array(z.enum(USER_ROLES)).min(1),
});

export async function GET() {
  try {
    const users = await userService.listUsers();
    return ok({ users });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }

    return errorResponse(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    return ok(await userService.createUser(payload), { status: 201 });
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

    return errorResponse(500, "Failed to create user.");
  }
}
