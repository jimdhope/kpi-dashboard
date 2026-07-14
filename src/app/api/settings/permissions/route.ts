import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { requireAdminUser } from "@/server/services/authorization";
import { permissionService } from "@/server/services/permission-service";
import { PERMISSION_LEVELS } from "@/lib/contracts";

export async function GET() {
  try {
    await requireAdminUser();
    const data = await permissionService.getAllPermissions();
    return ok(data);
  } catch (error) {
    console.error("GET /api/settings/permissions error:", error);
    return errorResponse(500, "Failed to fetch permissions");
  }
}

const updateSchema = z.object({
  updates: z.array(
    z.object({
      roleId: z.string(),
      resource: z.string(),
      level: z.enum(PERMISSION_LEVELS as any),
    })
  ),
});

export async function PUT(request: NextRequest) {
  try {
    await requireAdminUser();
    const body = await request.json();
    const payload = updateSchema.parse(body);
    await permissionService.setPermissionsBulk(payload.updates);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid payload");
    }
    console.error("PUT /api/settings/permissions error:", error);
    return errorResponse(500, "Failed to update permissions");
  }
}
