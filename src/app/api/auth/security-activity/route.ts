import { z } from "zod";
import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { activityService } from "@/server/services/activity-service";

const schema = z.object({
  action: z.enum(["passkey_added", "passkey_used", "passkey_renamed", "passkey_removed", "session_revoked", "sessions_revoked"]),
});

const labels: Record<z.infer<typeof schema>["action"], string> = {
  passkey_added: "Passkey Added",
  passkey_used: "Signed In With Passkey",
  passkey_renamed: "Passkey Renamed",
  passkey_removed: "Passkey Removed",
  session_revoked: "Session Revoked",
  sessions_revoked: "Other Sessions Revoked",
};

export async function POST(request: Request) {
  try {
    const user = await authService.requireCurrentUser();
    const { action } = schema.parse(await request.json());
    await activityService.logRecorderAction({
      agentId: user.id,
      agentName: user.name,
      type: "profile_updated",
      title: labels[action],
      description: "Account security settings were updated.",
      metadata: { securityAction: action },
    });
    return ok({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid security activity.");
    return errorResponse(401, "Unauthorized");
  }
}
