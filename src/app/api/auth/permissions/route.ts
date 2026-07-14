import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";

export async function GET() {
  try {
    const user = await authService.requireCurrentUser();
    const roleKeys = user.roles.map((r: any) => r);
    const perms = await permissionService.getPermissionsForRoles(roleKeys);
    return ok({ permissions: perms });
  } catch (error) {
    return errorResponse(401, "Unauthorized");
  }
}
