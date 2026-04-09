import { errorResponse, ok } from "@/server/http";
import { teamsMessageTemplateService } from "@/server/services/teams-message-template-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const template = await teamsMessageTemplateService.setDefault(id);
    return ok(template);
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }
    return errorResponse(500, "Failed to set default template.");
  }
}
