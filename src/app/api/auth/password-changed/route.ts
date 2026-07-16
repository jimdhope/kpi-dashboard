import { ok, errorResponse } from "@/server/http";
import { prisma } from "@/server/db/client";
import { authService } from "@/server/services/auth-service";

export async function POST() {
  try {
    const user = await authService.requireCurrentUser();
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } }),
      prisma.activity.create({ data: {
        userId: user.id,
        agentName: user.name,
        recorderId: user.id,
        recorderName: user.name,
        type: "profile_updated",
        title: "Password Changed",
        description: "The user changed their password and ended other sessions.",
        metadataJson: { fieldsUpdated: ["password"] },
        richMessage: `${user.name} changed their password`,
      } }),
    ]);
    return ok({ success: true });
  } catch {
    return errorResponse(401, "Unauthorized");
  }
}
