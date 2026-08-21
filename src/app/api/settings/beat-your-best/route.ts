import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { requireResourceAccess } from "@/server/services/authorization";
import { appSettingService } from "@/server/services/app-setting-service";

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  teamsAnnouncementEnabled: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireResourceAccess("nav.competitions.manage", "MANAGE");
    return ok(await appSettingService.getBeatYourBestSettings());
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    console.error("GET /api/settings/beat-your-best error:", error);
    return errorResponse(500, "Failed to load Beat Your Best settings.");
  }
}

export async function PUT(request: Request) {
  try {
    await requireResourceAccess("nav.competitions.manage", "MANAGE");
    const payload = updateSchema.parse(await request.json());
    return ok(await appSettingService.updateBeatYourBestSettings(payload));
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid Beat Your Best settings payload.");
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    console.error("PUT /api/settings/beat-your-best error:", error);
    return errorResponse(500, "Failed to update Beat Your Best settings.");
  }
}
