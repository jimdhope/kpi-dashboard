import { z } from "zod";
import {
  TEAMS_AUTOMATION_CONDITION_EVENTS,
  TEAMS_AUTOMATION_CONDITION_METRICS,
  TEAMS_AUTOMATION_DELIVERY_FORMATS,
  TEAMS_AUTOMATION_MODES,
  TEAMS_AUTOMATION_SCOPES,
  TEAMS_AUTOMATION_TRIGGERS,
} from "@/lib/contracts";
import { errorResponse, ok } from "@/server/http";
import { teamsAutomationService } from "@/server/services/teams-automation-service";

const factSchema = z.object({
  name: z.string().min(1).max(80),
  valueTemplate: z.string().min(1).max(400),
});

const schema = z.object({
  name: z.string().min(2).max(120),
  trigger: z.enum(TEAMS_AUTOMATION_TRIGGERS),
  scope: z.enum(TEAMS_AUTOMATION_SCOPES),
  mode: z.enum(TEAMS_AUTOMATION_MODES),
  deliveryFormat: z.enum(TEAMS_AUTOMATION_DELIVERY_FORMATS),
  messageTemplateId: z.string().cuid().optional().nullable(),
  campaignId: z.string().cuid().optional().nullable(),
  podId: z.string().cuid().optional().nullable(),
  outgoingWebhookId: z.string().cuid(),
  titleTemplate: z.string().min(2).max(200),
  messageTemplate: z.string().min(2).max(2000),
  facts: z.array(factSchema).max(8),
  adaptiveCardJson: z.string().max(20000).optional().nullable(),
  imageTitleTemplate: z.string().max(200).optional().nullable(),
  imageSubtitleTemplate: z.string().max(500).optional().nullable(),
  imageMetricTemplate: z.string().max(200).optional().nullable(),
  imageFooterTemplate: z.string().max(300).optional().nullable(),
  imageAccentColor: z.string().max(20).optional().nullable(),
  oneTimeAt: z.string().datetime().optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  timezone: z.string().min(3).max(120).optional().nullable(),
  windowStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  windowEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  quietStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  quietEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  repeatEveryMinutes: z.number().int().min(1).optional().nullable(),
  batchWindowMinutes: z.number().int().min(1).optional().nullable(),
  cooldownMinutes: z.number().int().min(1).optional().nullable(),
  conditionEvent: z.enum(TEAMS_AUTOMATION_CONDITION_EVENTS).optional().nullable(),
  conditionMetric: z.enum(TEAMS_AUTOMATION_CONDITION_METRICS).optional().nullable(),
  conditionLookbackMinutes: z.number().int().min(1).optional().nullable(),
  conditionMinimumCount: z.number().int().min(1).optional().nullable(),
  conditionMinimumValue: z.number().min(0).optional().nullable(),
  isActive: z.boolean(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const payload = schema.parse(await request.json());
    return ok(
      await teamsAutomationService.updateAutomation(params.id, {
        ...payload,
        oneTimeAt: payload.oneTimeAt ? new Date(payload.oneTimeAt) : null,
        startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
        endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
      }),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid Teams automation payload.");
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error) {
      return errorResponse(400, error.message);
    }
    return errorResponse(500, "Failed to update Teams automation.");
  }
}
