import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { requireResourceAccess } from "@/server/services/authorization";
import { postGeneratorService } from "@/server/services/post-generator-service";

export async function GET() {
  try {
    await authService.requireCurrentUser();
    await requireResourceAccess("nav.competitions.postGenerator", "VIEW");
    const settings = await postGeneratorService.getSettings();
    return ok(settings);
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    console.error("GET /api/competitions/post-generator/settings error:", error);
    return errorResponse(500, "Failed to load post generator settings.");
  }
}

const saveApiKeySchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
});

const saveTemplateSchema = z.object({
  type: z.enum(["ve", "teams"]),
  sections: z.array(
    z.object({
      name: z.string(),
      wordCount: z.number().int().min(0).max(500),
      content: z.string(),
      enabled: z.boolean(),
    })
  ),
});

export async function POST(request: Request) {
  try {
    await authService.requireCurrentUser();
    await requireResourceAccess("nav.competitions.postGenerator", "MANAGE");

    const body = await request.json();
    const { type, ...data } = body;

    if (type === "apiKey") {
      const parsed = saveApiKeySchema.parse(data);
      await postGeneratorService.saveApiKey(parsed.apiKey);
      return ok({ success: true });
    }

    if (type === "template") {
      const parsed = saveTemplateSchema.parse(data);
      await postGeneratorService.saveTemplate(parsed.type, parsed.sections);
      return ok({ success: true });
    }

    return errorResponse(400, "Invalid save type.");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    console.error("POST /api/competitions/post-generator/settings error:", error);
    return errorResponse(500, "Failed to save post generator settings.");
  }
}
