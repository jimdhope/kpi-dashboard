import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { teamsWebhookRepository } from "@/server/repositories/teams-webhook-repository";
import { teamsMessageTemplateRepository } from "@/server/repositories/teams-message-template-repository";
import { requireResourceAccess } from "@/server/services/authorization";

const schema = z.object({
  webhookId: z.string().min(1),
  templateId: z.string().optional(),
  title: z.string().optional(),
  message: z.string().optional(),
  context: z.record(z.string(), z.any()).optional(),
});

export async function POST(request: Request) {
  try {
    await requireResourceAccess("nav.integrations", "MANAGE");
    const rawBody = await request.text();
    const payloadSize = Buffer.byteLength(rawBody, "utf8");

    if (payloadSize > 30000) {
      console.error(`[Teams Send] REJECTED: Incoming payload too large (${payloadSize} bytes)`);
      return errorResponse(400, `Incoming payload too large (${payloadSize} bytes). Please reduce the data sent.`);
    }

    const payload = schema.parse(JSON.parse(rawBody));
    
    const webhook = await teamsWebhookRepository.findById(payload.webhookId);
    if (!webhook) return errorResponse(400, "Teams channel not found");
    if (!webhook.isActive) return errorResponse(400, "This Teams channel is not active");

    let title = payload.title || "";
    let messageText = payload.message || "";
    let facts: Array<{ name: string; value: string }> = [];
    let deliveryFormat = "adaptiveCard";

    if (payload.templateId) {
      const template = await teamsMessageTemplateRepository.findById(payload.templateId);
      if (!template) return errorResponse(400, "Template not found");

      title = payload.title || template.titleTemplate;
      messageText = payload.message || template.messageTemplate;
      deliveryFormat = template.deliveryFormat;

      const context = payload.context || {};
      const interpolate = (str: string) => {
        return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
          const value = context[key];
          if (key === 'achievementBadge' && context.achievementCount) {
            const count = Number(context.achievementCount) || 1;
            return String(value ?? '').repeat(Math.min(count, 10));
          }
          return String(value ?? `{{${key}}}`);
        });
      };

      const templateFacts = template.facts.map((f) => ({
        name: f.name,
        value: interpolate(f.valueTemplate),
      }));

      if (payload.context?.facts && Array.isArray(payload.context.facts)) {
        facts = payload.context.facts as Array<{ name: string; value: string }>;
        facts = [...facts, ...templateFacts];
      } else {
        facts = templateFacts;
      }
    }

    if (!payload.templateId && !title && !messageText) {
      title = "Performance Summary";
      messageText = `Performance summary for ${payload.context?.timeframe || 'current period'}`;
    }

    const cardPayload = buildAdaptiveCard({
      title,
      message: messageText,
      facts,
      kpiRows: payload.context?.kpiRows as any,
      deliveryFormat,
    });

    const finalPayloadSize = Buffer.byteLength(JSON.stringify(cardPayload), "utf8");
    if (finalPayloadSize > 25000) {
      return errorResponse(400, "Generated Teams message is too large. Please reduce its content.");
    }

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cardPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Teams webhook error:", response.status, errorText);
        return errorResponse(400, `Failed to send to Teams: ${response.status}`);
      }

      return ok({ success: true, message: "Message sent successfully" });
    } catch (sendError) {
      console.error("Teams send error:", sendError);
      return errorResponse(500, "Failed to send message to Teams");
    }
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid request payload");
    if (error instanceof Error && error.message === "Unauthorized") return errorResponse(401, "Unauthorized");
    console.error("Teams send error:", error);
    return errorResponse(500, "Failed to send message");
  }
}

interface CardParams {
  title: string;
  message: string;
  facts: Array<{ name: string; value: string }>;
  kpiRows?: Array<{
    kpiName: string;
    entries: Array<{
      rank: number;
      name: string;
      score: string;
    }>;
  }>;
  deliveryFormat: string;
}

function buildSimpleTextCard(title: string, message: string) {
  return {
    type: "message",
    attachments: [{
      contentType: "application/vnd.microsoft.card.adaptive",
      content: {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard",
        version: "1.4",
        body: [{ type: "TextBlock", text: `${title}\n\n${message}\n\n(Data truncated due to size limits)`, wrap: true }]
      }
    }]
  };
}

function buildAdaptiveCard(params: CardParams): object {
  const { title, message, facts, kpiRows } = params;

  const cardBody: any[] = [
    { type: "TextBlock", size: "Large", weight: "Bolder", text: title, wrap: true },
    { type: "TextBlock", text: message, wrap: true, spacing: "Medium" },
  ];

  if (kpiRows && kpiRows.length > 0) {
    kpiRows.slice(0, 3).forEach((row) => {
      cardBody.push({
        type: "TextBlock",
        text: row.kpiName,
        weight: "Bolder",
        spacing: "Large",
        separator: true,
      });

      const factEntries = row.entries.slice(0, 2).map(e => ({
        title: `${e.rank}. ${e.name}`,
        value: e.score
      }));

      if (factEntries.length > 0) {
        cardBody.push({
          type: "FactSet",
          facts: factEntries
        });
      }
    });
  } else if (facts.length > 0) {
    cardBody.push({
      type: "FactSet",
      facts: facts.map((f) => ({ title: f.name, value: f.value })),
    });
  }

  const finalPayload = {
    type: "message",
    attachments: [{
      contentType: "application/vnd.microsoft.card.adaptive",
      content: {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard",
        version: "1.4",
        body: cardBody,
      },
    }],
  };

  if (JSON.stringify(finalPayload).length > 25000) {
    console.warn("[Teams Send] Adaptive Card too large, falling back to plain text");
    return buildSimpleTextCard(title, message);
  }

  return finalPayload;
}
