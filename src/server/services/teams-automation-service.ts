import {
  TeamsAutomationConditionMetric,
  TeamsAutomationDeliveryFormat,
  TeamsAutomationFactTemplate,
  TeamsAutomationMode,
  TeamsAutomationRecord,
  TeamsAutomationScope,
  TeamsAutomationTrigger,
} from "@/lib/contracts";
import { teamsAutomationRepository } from "@/server/repositories/teams-automation-repository";
import { teamsWebhookRepository } from "@/server/repositories/teams-webhook-repository";
import { requireAdminUser } from "@/server/services/authorization";
import { teamsEventService } from "@/server/services/teams-event-service";

function renderTemplate(template: string, context: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => context[key] ?? "");
}

function renderFacts(facts: TeamsAutomationFactTemplate[], context: Record<string, string>) {
  return facts
    .map((fact) => ({
      name: fact.name,
      value: renderTemplate(fact.valueTemplate, context).trim(),
    }))
    .filter((fact) => fact.value.length > 0);
}

export const teamsAutomationService = {
  async listAutomations() {
    await requireAdminUser();
    return teamsAutomationRepository.list();
  },

  async listRecentIncomingEvents() {
    await requireAdminUser();
    return teamsAutomationRepository.listRecentIncomingEvents();
  },

  async createAutomation(input: {
    name: string;
    trigger: TeamsAutomationTrigger;
    scope: TeamsAutomationScope;
    mode: TeamsAutomationMode;
    deliveryFormat: TeamsAutomationDeliveryFormat;
    messageTemplateId?: string | null;
    campaignId?: string | null;
    podId?: string | null;
    outgoingWebhookId: string;
    titleTemplate: string;
    messageTemplate: string;
    facts: TeamsAutomationFactTemplate[];
    adaptiveCardJson?: string | null;
    imageTitleTemplate?: string | null;
    imageSubtitleTemplate?: string | null;
    imageMetricTemplate?: string | null;
    imageFooterTemplate?: string | null;
    imageAccentColor?: string | null;
    oneTimeAt?: Date | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    timezone?: string | null;
    windowStartTime?: string | null;
    windowEndTime?: string | null;
    quietStartTime?: string | null;
    quietEndTime?: string | null;
    repeatEveryMinutes?: number | null;
    batchWindowMinutes?: number | null;
    cooldownMinutes?: number | null;
    conditionEvent?: "performanceLogged" | "competitionScoreLogged" | null;
    conditionMetric?: TeamsAutomationConditionMetric | null;
    conditionLookbackMinutes?: number | null;
    conditionMinimumCount?: number | null;
    conditionMinimumValue?: number | null;
    onlyIfNewData?: boolean;
    conditionActivityWithinMinutes?: number | null;
    isActive: boolean;
  }) {
    await requireAdminUser();
    validateAutomationInput(input);
    return teamsAutomationRepository.create(input);
  },

  async updateAutomation(
    id: string,
    input: {
      name: string;
      trigger: TeamsAutomationTrigger;
      scope: TeamsAutomationScope;
      mode: TeamsAutomationMode;
      deliveryFormat: TeamsAutomationDeliveryFormat;
      messageTemplateId?: string | null;
      campaignId?: string | null;
      podId?: string | null;
      outgoingWebhookId: string;
      titleTemplate: string;
      messageTemplate: string;
      facts: TeamsAutomationFactTemplate[];
      adaptiveCardJson?: string | null;
      imageTitleTemplate?: string | null;
      imageSubtitleTemplate?: string | null;
      imageMetricTemplate?: string | null;
      imageFooterTemplate?: string | null;
      imageAccentColor?: string | null;
      oneTimeAt?: Date | null;
      startsAt?: Date | null;
      endsAt?: Date | null;
      timezone?: string | null;
      windowStartTime?: string | null;
      windowEndTime?: string | null;
      quietStartTime?: string | null;
      quietEndTime?: string | null;
      repeatEveryMinutes?: number | null;
      batchWindowMinutes?: number | null;
      cooldownMinutes?: number | null;
      conditionEvent?: "performanceLogged" | "competitionScoreLogged" | null;
      conditionMetric?: TeamsAutomationConditionMetric | null;
      conditionLookbackMinutes?: number | null;
      conditionMinimumCount?: number | null;
      conditionMinimumValue?: number | null;
      onlyIfNewData?: boolean;
      conditionActivityWithinMinutes?: number | null;
      isActive: boolean;
    },
  ) {
    await requireAdminUser();
    validateAutomationInput(input);
    return teamsAutomationRepository.update(id, input);
  },

  async dispatchTriggeredAutomations(input: {
    trigger: TeamsAutomationTrigger;
    campaignIds?: string[];
    podIds?: string[];
    context: Record<string, string>;
  }) {
    const automations = await teamsAutomationRepository.listActiveForTrigger({
      trigger: input.trigger,
      campaignIds: input.campaignIds,
      podIds: input.podIds,
    });

    for (const automation of automations) {
      await dispatchAutomationIfEligible(automation, input.context, new Date());
    }
  },

  async processScheduledAutomations(now = new Date()) {
    const automations = await teamsAutomationRepository.listActiveScheduled();

    for (const automation of automations) {
      if (!isScheduledDue(automation, now)) {
        continue;
      }

      const context = {
        automationId: automation.id,
        automationName: automation.name,
        campaignId: automation.campaignId ?? "",
        campaignName: automation.campaignName ?? "Unassigned",
        podId: automation.podId ?? "",
        podName: automation.podName ?? "Unassigned",
        now: now.toISOString(),
      };

      await dispatchAutomationIfEligible(automation, context, now);
    }

    await flushPendingBatches(now);
  },

  async handleIncomingWebhook(input: {
    endpointId: string;
    payload: unknown;
    headers?: Record<string, string>;
  }) {
    const endpoint = await teamsWebhookRepository.findActiveIncomingById(input.endpointId);
    if (!endpoint) {
      throw new Error("Incoming Teams webhook endpoint not found.");
    }

    const scopeContext = await teamsWebhookRepository.getIncomingScopeContext(endpoint.id);
    const firstCampaign = scopeContext.campaigns[0] ?? null;
    const firstPod = scopeContext.pods[0] ?? null;
    const relatedCampaign = firstCampaign || firstPod
      ? {
          id: firstCampaign?.id ?? firstPod?.campaignId ?? "",
          name: firstCampaign?.name ?? firstPod?.campaign?.name ?? "Unassigned",
        }
      : null;
    const relatedPod = firstPod;

    const event = await teamsAutomationRepository.createIncomingEvent({
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      payload: input.payload,
      headers: input.headers,
    });

    const payloadObject =
      input.payload && typeof input.payload === "object" ? (input.payload as Record<string, unknown>) : null;

    await teamsAutomationService.dispatchTriggeredAutomations({
      trigger: "incomingWebhookReceived",
      campaignIds: scopeContext.campaigns.map((campaign) => campaign.id).concat(
        scopeContext.pods
          .map((pod) => pod.campaignId)
          .filter((campaignId): campaignId is string => Boolean(campaignId)),
      ),
      podIds: scopeContext.pods.map((pod) => pod.id),
      context: {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        campaignId: relatedCampaign?.id ?? "",
        campaignName: relatedCampaign?.name ?? "Unassigned",
        podId: relatedPod?.id ?? "",
        podName: relatedPod?.name ?? "Unassigned",
        payloadText: stringifyField(payloadObject?.text),
        payloadSummary: stringifyField(payloadObject?.summary),
        payloadTitle: stringifyField(payloadObject?.title),
        payloadJson: JSON.stringify(input.payload),
        eventId: event.id,
      },
    });

    return event;
  },
};

function validateScope(scope: TeamsAutomationScope, campaignId?: string | null, podId?: string | null) {
  if (scope === "campaign" && !campaignId) {
    throw new Error("Campaign scope requires a campaign.");
  }

  if (scope === "pod" && !podId) {
    throw new Error("Pod scope requires a pod.");
  }
}

function validateAutomationInput(input: {
  scope: TeamsAutomationScope;
  campaignId?: string | null;
  podId?: string | null;
  mode: TeamsAutomationMode;
  oneTimeAt?: Date | null;
  timezone?: string | null;
  repeatEveryMinutes?: number | null;
  windowStartTime?: string | null;
  windowEndTime?: string | null;
  quietStartTime?: string | null;
  quietEndTime?: string | null;
  batchWindowMinutes?: number | null;
  cooldownMinutes?: number | null;
  conditionMetric?: TeamsAutomationConditionMetric | null;
  conditionLookbackMinutes?: number | null;
  conditionMinimumCount?: number | null;
  conditionMinimumValue?: number | null;
  onlyIfNewData?: boolean;
  conditionActivityWithinMinutes?: number | null;
  adaptiveCardJson?: string | null;
}) {
  validateScope(input.scope, input.campaignId, input.podId);

  if (input.mode === "oneTime" && !input.oneTimeAt) {
    throw new Error("One-time automations require a scheduled date and time.");
  }

  if (input.mode === "recurring" && (!input.repeatEveryMinutes || input.repeatEveryMinutes < 1)) {
    throw new Error("Recurring automations require a repeat interval.");
  }

  if (input.windowStartTime && !isTimeString(input.windowStartTime)) {
    throw new Error("Window start time must be in HH:MM format.");
  }

  if (input.windowEndTime && !isTimeString(input.windowEndTime)) {
    throw new Error("Window end time must be in HH:MM format.");
  }

  if (input.quietStartTime && !isTimeString(input.quietStartTime)) {
    throw new Error("Quiet start time must be in HH:MM format.");
  }

  if (input.quietEndTime && !isTimeString(input.quietEndTime)) {
    throw new Error("Quiet end time must be in HH:MM format.");
  }

  if (input.cooldownMinutes !== null && input.cooldownMinutes !== undefined && input.cooldownMinutes < 1) {
    throw new Error("Cooldown minutes must be at least 1.");
  }

  if (input.batchWindowMinutes !== null && input.batchWindowMinutes !== undefined && input.batchWindowMinutes < 1) {
    throw new Error("Batch window minutes must be at least 1.");
  }

  if (
    input.conditionLookbackMinutes !== null &&
    input.conditionLookbackMinutes !== undefined &&
    input.conditionLookbackMinutes < 1
  ) {
    throw new Error("Condition lookback minutes must be at least 1.");
  }

  if (
    input.conditionMinimumCount !== null &&
    input.conditionMinimumCount !== undefined &&
    input.conditionMinimumCount < 1
  ) {
    throw new Error("Condition minimum count must be at least 1.");
  }

  if (
    input.conditionMinimumValue !== null &&
    input.conditionMinimumValue !== undefined &&
    input.conditionMinimumValue < 0
  ) {
    throw new Error("Condition minimum value must be zero or greater.");
  }

  if (input.timezone) {
    validateTimezone(input.timezone);
  }

  if (input.adaptiveCardJson) {
    try {
      JSON.parse(input.adaptiveCardJson);
    } catch {
      throw new Error("Adaptive card JSON must be valid JSON.");
    }
  }
}

async function dispatchAutomationIfEligible(
  automation: TeamsAutomationRecord,
  context: Record<string, string>,
  now: Date,
) {
  if (!(await passesCooldown(automation, now))) {
    return;
  }

  if (isWithinQuietHours(now, automation)) {
    return;
  }

  if (!(await passesCondition(automation, now))) {
    return;
  }

  // Check "only if competition activity in last X minutes" condition
  if (!(await passesActivityCondition(automation, now))) {
    return; // Skip if no competition activity in the time window
  }

  const title = renderTemplate(automation.titleTemplate, context).trim() || automation.name;
  const text = renderTemplate(automation.messageTemplate, context).trim();
  const facts = renderFacts(automation.facts, context);
  const rawPayload = buildTeamsPayload(automation, context, title, text, facts);

  if (automation.batchWindowMinutes) {
    await teamsAutomationRepository.createPendingDelivery({
      automationId: automation.id,
      title,
      text,
      facts,
      dueAt: new Date(now.getTime() + automation.batchWindowMinutes * 60_000),
    });
  } else {
    await teamsEventService.queueDeliveries({
      webhookIds: [automation.outgoingWebhookId],
      title,
      text,
      facts,
      rawPayload,
    });
    // Update lastPostAt to track when message was sent
    await teamsWebhookRepository.updateLastPostAt(automation.outgoingWebhookId);
    await teamsAutomationRepository.markTriggered(automation.id, now);
    return;
  }

  await teamsAutomationRepository.markTriggered(automation.id, now);
}

async function passesCondition(automation: TeamsAutomationRecord, now: Date) {
  if (!automation.conditionEvent || !automation.conditionLookbackMinutes) {
    return true;
  }

  const activity = await teamsAutomationRepository.countRecentActivity({
    event: automation.conditionEvent,
    since: new Date(now.getTime() - automation.conditionLookbackMinutes * 60_000),
    campaignId: automation.campaignId,
    podId: automation.podId,
  });

  if (automation.conditionMetric === "totalValue") {
    return activity.totalValue >= (automation.conditionMinimumValue ?? 0);
  }

  return activity.count >= (automation.conditionMinimumCount ?? 1);
}

async function passesCooldown(automation: TeamsAutomationRecord, now: Date) {
  const intervalMinutes =
    automation.mode === "recurring"
      ? automation.repeatEveryMinutes
      : automation.cooldownMinutes;

  if (!automation.lastTriggeredAt || !intervalMinutes) {
    return true;
  }

  const lastTriggeredAt = new Date(automation.lastTriggeredAt);
  return now.getTime() - lastTriggeredAt.getTime() >= intervalMinutes * 60_000;
}

async function passesActivityCondition(
  automation: TeamsAutomationRecord,
  now: Date
) {
  // If no condition set, always pass
  if (!automation.conditionActivityWithinMinutes) {
    return true;
  }

  // Check for competition activity within the specified time window
  const since = new Date(now.getTime() - automation.conditionActivityWithinMinutes * 60_000);
  
  const activity = await teamsAutomationRepository.countRecentActivity({
    event: "competitionScoreLogged",
    since,
    campaignId: automation.campaignId,
    podId: automation.podId,
  });

  // Only pass if there's at least one activity
  return activity.count > 0;
}

function isScheduledDue(automation: TeamsAutomationRecord, now: Date) {
  if (automation.mode === "oneTime") {
    if (!automation.oneTimeAt) {
      return false;
    }

    if (automation.lastTriggeredAt) {
      return false;
    }

    return new Date(automation.oneTimeAt) <= now;
  }

  if (automation.mode !== "recurring") {
    return false;
  }

  if (automation.startsAt && new Date(automation.startsAt) > now) {
    return false;
  }

  if (automation.endsAt && new Date(automation.endsAt) < now) {
    return false;
  }

  if (!isWithinTimeWindow(now, automation.windowStartTime, automation.windowEndTime, automation.timezone ?? "UTC")) {
    return false;
  }

  if (!automation.repeatEveryMinutes) {
    return false;
  }

  if (!automation.lastTriggeredAt) {
    return true;
  }

  return now.getTime() - new Date(automation.lastTriggeredAt).getTime() >= automation.repeatEveryMinutes * 60_000;
}

function isWithinTimeWindow(now: Date, start: string | null, end: string | null, timezone: string) {
  if (!start && !end) {
    return true;
  }

  const currentMinutes = getTimePartsInTimezone(now, timezone).minutes;
  const startMinutes = start ? parseTimeToMinutes(start) : 0;
  const endMinutes = end ? parseTimeToMinutes(end) : 24 * 60;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

function isWithinQuietHours(now: Date, automation: TeamsAutomationRecord) {
  if (!automation.quietStartTime && !automation.quietEndTime) {
    return false;
  }

  return isWithinTimeWindow(now, automation.quietStartTime, automation.quietEndTime, automation.timezone ?? "UTC");
}

function parseTimeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getTimePartsInTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return {
    hour,
    minute,
    minutes: hour * 60 + minute,
  };
}

function isTimeString(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function validateTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error("Timezone must be a valid IANA timezone.");
  }
}

async function flushPendingBatches(now: Date) {
  const dueDeliveries = await teamsAutomationRepository.listDuePendingDeliveries(now);
  const grouped = new Map<string, typeof dueDeliveries>();

  for (const delivery of dueDeliveries) {
    const current = grouped.get(delivery.automationId) ?? [];
    current.push(delivery);
    grouped.set(delivery.automationId, current);
  }

  for (const [automationId, deliveries] of grouped) {
    const first = deliveries[0];
    const title = deliveries.length === 1 ? first.title : `${first.title} (${deliveries.length} messages)`;
    const text =
      deliveries.length === 1
        ? first.text
        : deliveries.map((delivery: { text: string }, index: number) => `${index + 1}. ${delivery.text}`).join("\n");
    const facts = deliveries.flatMap((delivery: { factsJson: unknown }) => normalizePendingFacts(delivery.factsJson));
    const rawPayload = buildDefaultAdaptiveCardPayload(title, text, facts);

    await teamsEventService.queueDeliveries({
      webhookIds: [first.automation.outgoingWebhookId],
      title,
      text,
      facts: facts.length > 0 ? facts : undefined,
      rawPayload,
    });

    await teamsAutomationRepository.markPendingDeliveriesSent(
      deliveries.map((delivery: { id: string }) => delivery.id),
      now,
    );
    await teamsAutomationRepository.markTriggered(automationId, now);
  }
}

function normalizePendingFacts(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((fact) => {
      if (!fact || typeof fact !== "object") {
        return null;
      }
      const record = fact as Record<string, unknown>;
      if (typeof record.name !== "string" || typeof record.value !== "string") {
        return null;
      }
      return {
        name: record.name,
        value: record.value,
      };
    })
    .filter((fact): fact is { name: string; value: string } => Boolean(fact));
}

function buildTeamsPayload(
  automation: TeamsAutomationRecord,
  context: Record<string, string>,
  title: string,
  text: string,
  facts: Array<{ name: string; value: string }>,
) {
  if (automation.deliveryFormat === "messageCard") {
    return undefined;
  }

  const imageUrl =
    automation.deliveryFormat === "adaptiveCardWithImage"
      ? buildImageUrl(automation, context)
      : undefined;

  if (automation.adaptiveCardJson) {
    const renderedJson = renderTemplate(automation.adaptiveCardJson, {
      ...context,
      imageUrl: imageUrl ?? "",
    });
    return wrapAdaptiveCard(JSON.parse(renderedJson) as Record<string, unknown>);
  }

  return buildDefaultAdaptiveCardPayload(title, text, facts, imageUrl);
}

function buildImageUrl(automation: TeamsAutomationRecord, context: Record<string, string>) {
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!appUrl) {
    return undefined;
  }

  const params = new URLSearchParams({
    title: renderTemplate(automation.imageTitleTemplate ?? automation.titleTemplate, context),
    subtitle: renderTemplate(automation.imageSubtitleTemplate ?? automation.messageTemplate, context),
    metric: renderTemplate(automation.imageMetricTemplate ?? "", context),
    footer: renderTemplate(automation.imageFooterTemplate ?? "", context),
    accent: (automation.imageAccentColor ?? "007A5A").replace("#", ""),
  });

  return `${appUrl}/api/render/teams-image?${params.toString()}`;
}

function wrapAdaptiveCard(card: Record<string, unknown>) {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: card,
      },
    ],
  };
}

function buildDefaultAdaptiveCardPayload(
  title: string,
  text: string,
  facts: Array<{ name: string; value: string }>,
  imageUrl?: string,
) {
  const body: Record<string, unknown>[] = [
    {
      type: "TextBlock",
      size: "Large",
      weight: "Bolder",
      text: title,
      wrap: true,
    },
    {
      type: "TextBlock",
      text,
      wrap: true,
      spacing: "Medium",
    },
  ];

  if (imageUrl) {
    body.push({
      type: "Image",
      url: imageUrl,
      size: "Stretch",
      spacing: "Medium",
    });
  }

  if (facts.length > 0) {
    body.push({
      type: "FactSet",
      spacing: "Medium",
      facts,
    });
  }

  return wrapAdaptiveCard({
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.4",
    body,
  });
}

function stringifyField(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}
