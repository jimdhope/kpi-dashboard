import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { teamsWebhookRepository } from "@/server/repositories/teams-webhook-repository";
import { teamsMessageTemplateRepository } from "@/server/repositories/teams-message-template-repository";
import { requireAdminUser } from "@/server/services/authorization";

const schema = z.object({
  webhookId: z.string().min(1),
  templateId: z.string().optional(),
  title: z.string().optional(),
  message: z.string().optional(),
  // Optional context data for template interpolation
  context: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdminUser();
    const payload = schema.parse(await request.json());

    // Get the webhook
    const webhook = await teamsWebhookRepository.findById(payload.webhookId);
    if (!webhook) {
      return errorResponse(400, "Teams channel not found");
    }

    if (!webhook.isActive) {
      return errorResponse(400, "This Teams channel is not active");
    }

    // Build the message
    let title = payload.title || "";
    let messageText = payload.message || "";
    let facts: Array<{ name: string; value: string }> = [];
    let imageTitle = "";
    let imageSubtitle = "";
    let imageMetric = "";
    let imageFooter = "";
    let deliveryFormat = "adaptiveCard";

    // If using a template, load it
    if (payload.templateId) {
      const template = await teamsMessageTemplateRepository.findById(payload.templateId);
      if (!template) {
        return errorResponse(400, "Template not found");
      }

      // Use template values or custom overrides
      title = payload.title || template.titleTemplate;
      messageText = payload.message || template.messageTemplate;
      deliveryFormat = template.deliveryFormat;

      // Interpolate template with context
      const context = payload.context || {};
      
      // Enhanced interpolate that handles repeating emojis based on count
      const interpolate = (str: string) => {
        return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
          const value = context[key];
          
          // Handle achievementBadge with count - if context has achievementCount, repeat the badge
          if (key === 'achievementBadge' && context.achievementCount) {
            const count = Number(context.achievementCount) || 1;
            const badge = String(value ?? '');
            return badge.repeat(Math.min(count, 10)); // Max 10 repeats to prevent abuse
          }
          
          // Handle any *Count variables to repeat the preceding value
          if (key.endsWith('Count') || key === 'achievementCount') {
            // This is handled by specific keys above
            return String(value ?? `{{${key}}}`);
          }
          
          return String(value ?? `{{${key}}}`);
        });
      };

      // Process facts
      facts = template.facts.map((f) => ({
        name: f.name,
        value: interpolate(f.valueTemplate),
      }));

      // Process image fields
      if (template.imageTitleTemplate) {
        imageTitle = interpolate(template.imageTitleTemplate);
      }
      if (template.imageSubtitleTemplate) {
        imageSubtitle = interpolate(template.imageSubtitleTemplate);
      }
      if (template.imageMetricTemplate) {
        imageMetric = interpolate(template.imageMetricTemplate);
      }
      if (template.imageFooterTemplate) {
        imageFooter = interpolate(template.imageFooterTemplate);
      }
    }

    // Build the Adaptive Card payload
    const cardPayload = buildAdaptiveCard({
      title,
      message: messageText,
      facts,
      deliveryFormat,
      imageTitle,
      imageSubtitle,
      imageMetric,
      imageFooter,
    });

    // Send to Teams
    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cardPayload),
      });

      if (!response.ok && response.status !== 200) {
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
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid request payload");
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    console.error("Teams send error:", error);
    return errorResponse(500, "Failed to send message");
  }
}

interface CardParams {
  title: string;
  message: string;
  facts: Array<{ name: string; value: string }>;
  deliveryFormat: string;
  imageTitle?: string;
  imageSubtitle?: string;
  imageMetric?: string;
  imageFooter?: string;
}

function buildAdaptiveCard(params: CardParams): object {
  const { title, message, facts, deliveryFormat, imageTitle, imageSubtitle, imageMetric, imageFooter } = params;

  // Simple adaptive card
  const cardBody: object[] = [
    {
      type: "TextBlock",
      size: "Large",
      weight: "Bolder",
      text: title,
      wrap: true,
    },
    {
      type: "TextBlock",
      text: message,
      wrap: true,
      spacing: "Medium",
    },
  ];

  // Add facts if present
  if (facts.length > 0) {
    cardBody.push({
      type: "FactSet",
      facts: facts.map((f) => ({
        title: f.name,
        value: f.value,
      })),
    });
  }

  // If image format requested and we have image data
  if (deliveryFormat === "adaptiveCardWithImage" && (imageTitle || imageMetric)) {
    return {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          contentUrl: null,
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.4",
            body: [
              {
                type: "ColumnSet",
                columns: [
                  {
                    type: "Column",
                    width: "stretch",
                    items: cardBody,
                  },
                ],
              },
            ],
          },
        },
      ],
    };
  }

  // Default adaptive card
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: cardBody,
        },
      },
    ],
  };
}
