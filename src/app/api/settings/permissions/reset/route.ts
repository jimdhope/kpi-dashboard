import { errorResponse, ok } from "@/server/http";
import { requireAdminUser } from "@/server/services/authorization";
import { permissionService } from "@/server/services/permission-service";

export async function POST() {
  try {
    await requireAdminUser();
    await permissionService.seedDefaults();
    return ok({ success: true, message: "Permissions reset to defaults" });
  } catch (error) {
    console.error("POST /api/settings/permissions/reset error:", error);
    return errorResponse(500, "Failed to reset permissions");
  }
}
