import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { requireResourceAccess } from "@/server/services/authorization";
import { permissionService } from "@/server/services/permission-service";
import { PERMISSION_LEVELS } from "@/lib/contracts";

export async function GET() {
  try {
    await requireResourceAccess("nav.settings.permissions", "MANAGE");
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
  ).default([]),
  dataScopeUpdates: z.array(z.object({
    roleId: z.string(),
    resource: z.enum(["people", "competitions"]),
    level: z.enum(["NONE", "ASSIGNED_PODS", "ALL_PODS"]),
  })).default([]),
});

export async function PUT(request: NextRequest) {
  try {
    await requireResourceAccess("nav.settings.permissions", "MANAGE");
    const body = await request.json();
    const payload = updateSchema.parse(body);
    await permissionService.setPermissionsBulk(payload.updates);
    await permissionService.setDataScopesBulk(payload.dataScopeUpdates);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid payload");
    }
    console.error("PUT /api/settings/permissions error:", error);
    return errorResponse(500, "Failed to update permissions");
  }
}
