import { z } from "zod";
import { TEAMS_AUTOMATION_DELIVERY_FORMATS } from "@/lib/contracts";
import { errorResponse, ok } from "@/server/http";
import { teamsMessageTemplateService } from "@/server/services/teams-message-template-service";

const factSchema = z.object({
  name: z.string().min(1).max(80),
  valueTemplate: z.string().min(1).max(400),
});

const schema = z.object({
  name: z.string().min(2).max(120),
  deliveryFormat: z.enum(TEAMS_AUTOMATION_DELIVERY_FORMATS),
  titleTemplate: z.string().min(2).max(200),
  messageTemplate: z.string().min(2).max(2000),
  facts: z.array(factSchema).max(8),
  adaptiveCardJson: z.string().max(20000).optional().nullable(),
  imageTitleTemplate: z.string().max(200).optional().nullable(),
  imageSubtitleTemplate: z.string().max(500).optional().nullable(),
  imageMetricTemplate: z.string().max(200).optional().nullable(),
  imageFooterTemplate: z.string().max(300).optional().nullable(),
  imageAccentColor: z.string().max(20).optional().nullable(),
  isActive: z.boolean(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = schema.parse(await request.json());
    return ok(await teamsMessageTemplateService.updateTemplate(id, payload));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid Teams message template payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }
    return errorResponse(500, "Failed to update Teams message template.");
  }
}
