import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { appSettingService } from "@/server/services/app-setting-service";
import { beatYourBestService } from "@/server/services/beat-your-best-service";

const querySchema = z.object({
  scope: z.enum(["competition", "campaign"]).default("competition"),
  podIds: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? [...new Set(value.split(",").map((id) => id.trim()).filter(Boolean))].slice(0, 50)
        : [],
    ),
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await authService.requireCurrentUser();
    const { id } = await context.params;

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      scope: url.searchParams.get("scope") ?? undefined,
      podIds: url.searchParams.get("podIds") ?? undefined,
    });
    if (!parsed.success) {
      return errorResponse(400, "Invalid Beat Your Best query parameters.");
    }

    const [settings, standings] = await Promise.all([
      appSettingService.getBeatYourBestSettings(),
      beatYourBestService.getStandings(id, parsed.data),
    ]);
    return ok({ enabled: settings.enabled, ...standings });
  } catch (error) {
    if (error instanceof Error && error.message === "Competition not found") {
      return errorResponse(404, "Competition not found");
    }
    console.error("GET /api/competitions/[id]/beat-your-best error:", error);
    return errorResponse(500, "Failed to load Beat Your Best standings.");
  }
}
