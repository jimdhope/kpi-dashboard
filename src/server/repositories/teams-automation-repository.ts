import {
  TeamsAutomationConditionEvent,
  TeamsAutomationConditionMetric,
  TeamsAutomationDeliveryFormat,
  TeamsAutomationFactTemplate,
  TeamsAutomationMode,
  TeamsAutomationRecord,
  TeamsIncomingEventRecord,
} from "@/lib/contracts";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";

function normalizeFacts(value: unknown): TeamsAutomationFactTemplate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const fact = item as Record<string, unknown>;
      if (typeof fact.name !== "string" || typeof fact.valueTemplate !== "string") {
        return null;
      }

      return {
        name: fact.name,
        valueTemplate: fact.valueTemplate,
      };
    })
    .filter((item): item is TeamsAutomationFactTemplate => Boolean(item));
}

function mapAutomation(record: {
  id: string;
  name: string;
  trigger: "incomingWebhookReceived" | "performanceLogged" | "competitionScoreLogged";
  scope: "global" | "campaign" | "pod";
  mode: TeamsAutomationMode;
  deliveryFormat: TeamsAutomationDeliveryFormat;
  messageTemplateId: string | null;
  campaignId: string | null;
  podId: string | null;
  outgoingWebhookId: string;
  titleTemplate: string;
  messageTemplate: string;
  factsJson: unknown;
  adaptiveCardJson: unknown;
  imageTitleTemplate: string | null;
  imageSubtitleTemplate: string | null;
  imageMetricTemplate: string | null;
  imageFooterTemplate: string | null;
  imageAccentColor: string | null;
  oneTimeAt: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;
  timezone: string | null;
  windowStartTime: string | null;
  windowEndTime: string | null;
  quietStartTime: string | null;
  quietEndTime: string | null;
  repeatEveryMinutes: number | null;
  batchWindowMinutes: number | null;
  cooldownMinutes: number | null;
  conditionEvent: TeamsAutomationConditionEvent | null;
  conditionMetric: TeamsAutomationConditionMetric | null;
  conditionLookbackMinutes: number | null;
    conditionMinimumCount: number | null;
    conditionMinimumValue: number | null;
    onlyIfNewData: boolean;
    conditionActivityWithinMinutes: number | null;
    isActive: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  campaign?: { name: string } | null;
  pod?: { name: string } | null;
  outgoingWebhook?: { name: string } | null;
  messageTemplateRef?: {
    name: string;
    version: number;
    deliveryFormat: TeamsAutomationDeliveryFormat;
    titleTemplate: string;
    messageTemplate: string;
    factsJson: unknown;
    adaptiveCardJson: unknown;
    imageTitleTemplate: string | null;
    imageSubtitleTemplate: string | null;
    imageMetricTemplate: string | null;
    imageFooterTemplate: string | null;
    imageAccentColor: string | null;
  } | null;
}) : TeamsAutomationRecord {
  const resolved = record.messageTemplateRef ?? record;
  return {
    id: record.id,
    name: record.name,
    trigger: record.trigger,
    scope: record.scope,
    mode: record.mode,
    deliveryFormat: resolved.deliveryFormat,
    messageTemplateId: record.messageTemplateId,
    messageTemplateName: record.messageTemplateRef?.name ?? null,
    messageTemplateVersion: record.messageTemplateRef?.version ?? null,
    campaignId: record.campaignId,
    campaignName: record.campaign?.name ?? null,
    podId: record.podId,
    podName: record.pod?.name ?? null,
    outgoingWebhookId: record.outgoingWebhookId,
    outgoingWebhookName: record.outgoingWebhook?.name ?? "Unknown webhook",
    titleTemplate: resolved.titleTemplate,
    messageTemplate: resolved.messageTemplate,
    facts: normalizeFacts(resolved.factsJson),
    adaptiveCardJson: resolved.adaptiveCardJson ? JSON.stringify(resolved.adaptiveCardJson, null, 2) : null,
    imageTitleTemplate: resolved.imageTitleTemplate,
    imageSubtitleTemplate: resolved.imageSubtitleTemplate,
    imageMetricTemplate: resolved.imageMetricTemplate,
    imageFooterTemplate: resolved.imageFooterTemplate,
    imageAccentColor: resolved.imageAccentColor,
    oneTimeAt: record.oneTimeAt?.toISOString() ?? null,
    startsAt: record.startsAt?.toISOString() ?? null,
    endsAt: record.endsAt?.toISOString() ?? null,
    timezone: record.timezone,
    windowStartTime: record.windowStartTime,
    windowEndTime: record.windowEndTime,
    quietStartTime: record.quietStartTime,
    quietEndTime: record.quietEndTime,
    repeatEveryMinutes: record.repeatEveryMinutes,
    batchWindowMinutes: record.batchWindowMinutes,
    cooldownMinutes: record.cooldownMinutes,
    conditionEvent: record.conditionEvent,
    conditionMetric: record.conditionMetric,
    conditionLookbackMinutes: record.conditionLookbackMinutes,
    conditionMinimumCount: record.conditionMinimumCount,
    conditionMinimumValue: record.conditionMinimumValue,
    onlyIfNewData: record.onlyIfNewData,
    conditionActivityWithinMinutes: record.conditionActivityWithinMinutes,
    isActive: record.isActive,
    lastTriggeredAt: record.lastTriggeredAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapIncomingEvent(record: {
  id: string;
  endpointId: string;
  endpointName: string;
  payloadJson: unknown;
  createdAt: Date;
}): TeamsIncomingEventRecord {
  return {
    id: record.id,
    endpointId: record.endpointId,
    endpointName: record.endpointName,
    payloadPreview:
      typeof record.payloadJson === "string"
        ? record.payloadJson
        : JSON.stringify(record.payloadJson).slice(0, 280),
    createdAt: record.createdAt.toISOString(),
  };
}

const automationInclude = {
  campaign: {
    select: {
      name: true,
    },
  },
  pod: {
    select: {
      name: true,
    },
  },
  outgoingWebhook: {
    select: {
      name: true,
    },
  },
  messageTemplateRef: {
    select: {
      id: true,
      name: true,
      version: true,
      deliveryFormat: true,
      titleTemplate: true,
      messageTemplate: true,
      factsJson: true,
      adaptiveCardJson: true,
      imageTitleTemplate: true,
      imageSubtitleTemplate: true,
      imageMetricTemplate: true,
      imageFooterTemplate: true,
      imageAccentColor: true,
    },
  },
} satisfies Prisma.TeamsAutomationInclude;

export const teamsAutomationRepository = {
  async list() {
    const automations = await prisma.teamsAutomation.findMany({
      include: automationInclude,
      orderBy: [{ isActive: "desc" }, { trigger: "asc" }, { name: "asc" }],
    });

    return automations.map((automation) => mapAutomation(automation as never));
  },

  async create(input: {
    name: string;
    trigger: "incomingWebhookReceived" | "performanceLogged" | "competitionScoreLogged";
    scope: "global" | "campaign" | "pod";
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
    conditionEvent?: TeamsAutomationConditionEvent | null;
    conditionMetric?: TeamsAutomationConditionMetric | null;
    conditionLookbackMinutes?: number | null;
    conditionMinimumCount?: number | null;
    conditionMinimumValue?: number | null;
    onlyIfNewData?: boolean;
    conditionActivityWithinMinutes?: number | null;
    isActive: boolean;
  }) {
    const automation = await prisma.teamsAutomation.create({
      data: {
        name: input.name,
        trigger: input.trigger,
        scope: input.scope,
        mode: input.mode,
        deliveryFormat: input.deliveryFormat,
        messageTemplateId: input.messageTemplateId ?? null,
        campaignId: input.campaignId ?? null,
        podId: input.podId ?? null,
        outgoingWebhookId: input.outgoingWebhookId,
        titleTemplate: input.titleTemplate,
        messageTemplate: input.messageTemplate,
        factsJson: input.facts as unknown as Prisma.InputJsonValue,
        adaptiveCardJson: input.adaptiveCardJson ? (JSON.parse(input.adaptiveCardJson) as Prisma.InputJsonValue) : null,
        imageTitleTemplate: input.imageTitleTemplate ?? null,
        imageSubtitleTemplate: input.imageSubtitleTemplate ?? null,
        imageMetricTemplate: input.imageMetricTemplate ?? null,
        imageFooterTemplate: input.imageFooterTemplate ?? null,
        imageAccentColor: input.imageAccentColor ?? null,
        oneTimeAt: input.oneTimeAt ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        timezone: input.timezone ?? "UTC",
        windowStartTime: input.windowStartTime ?? null,
        windowEndTime: input.windowEndTime ?? null,
        quietStartTime: input.quietStartTime ?? null,
        quietEndTime: input.quietEndTime ?? null,
        repeatEveryMinutes: input.repeatEveryMinutes ?? null,
        batchWindowMinutes: input.batchWindowMinutes ?? null,
        cooldownMinutes: input.cooldownMinutes ?? null,
        conditionEvent: input.conditionEvent ?? null,
        conditionMetric: input.conditionMetric ?? null,
        conditionLookbackMinutes: input.conditionLookbackMinutes ?? null,
        conditionMinimumCount: input.conditionMinimumCount ?? null,
        conditionMinimumValue: input.conditionMinimumValue ?? null,
        onlyIfNewData: input.onlyIfNewData ?? false,
        conditionActivityWithinMinutes: input.conditionActivityWithinMinutes ?? null,
        isActive: input.isActive,
      } as Prisma.TeamsAutomationUncheckedCreateInput,
      include: automationInclude,
    });

    return mapAutomation(automation as never);
  },

  async update(
    id: string,
    input: {
      name: string;
      trigger: "incomingWebhookReceived" | "performanceLogged" | "competitionScoreLogged";
      scope: "global" | "campaign" | "pod";
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
      conditionEvent?: TeamsAutomationConditionEvent | null;
      conditionMetric?: TeamsAutomationConditionMetric | null;
      conditionLookbackMinutes?: number | null;
      conditionMinimumCount?: number | null;
      conditionMinimumValue?: number | null;
      onlyIfNewData?: boolean;
      conditionActivityWithinMinutes?: number | null;
      isActive: boolean;
    },
  ) {
    const automation = await prisma.teamsAutomation.update({
      where: { id },
      data: {
        name: input.name,
        trigger: input.trigger,
        scope: input.scope,
        mode: input.mode,
        deliveryFormat: input.deliveryFormat,
        messageTemplateId: input.messageTemplateId ?? null,
        campaignId: input.campaignId ?? null,
        podId: input.podId ?? null,
        outgoingWebhookId: input.outgoingWebhookId,
        titleTemplate: input.titleTemplate,
        messageTemplate: input.messageTemplate,
        factsJson: input.facts as unknown as Prisma.InputJsonValue,
        adaptiveCardJson: input.adaptiveCardJson ? (JSON.parse(input.adaptiveCardJson) as Prisma.InputJsonValue) : Prisma.JsonNull,
        imageTitleTemplate: input.imageTitleTemplate ?? null,
        imageSubtitleTemplate: input.imageSubtitleTemplate ?? null,
        imageMetricTemplate: input.imageMetricTemplate ?? null,
        imageFooterTemplate: input.imageFooterTemplate ?? null,
        imageAccentColor: input.imageAccentColor ?? null,
        oneTimeAt: input.oneTimeAt ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        timezone: input.timezone ?? "UTC",
        windowStartTime: input.windowStartTime ?? null,
        windowEndTime: input.windowEndTime ?? null,
        quietStartTime: input.quietStartTime ?? null,
        quietEndTime: input.quietEndTime ?? null,
        repeatEveryMinutes: input.repeatEveryMinutes ?? null,
        batchWindowMinutes: input.batchWindowMinutes ?? null,
        cooldownMinutes: input.cooldownMinutes ?? null,
        conditionEvent: input.conditionEvent ?? null,
        conditionMetric: input.conditionMetric ?? null,
        conditionLookbackMinutes: input.conditionLookbackMinutes ?? null,
        conditionMinimumCount: input.conditionMinimumCount ?? null,
        conditionMinimumValue: input.conditionMinimumValue ?? null,
        onlyIfNewData: input.onlyIfNewData ?? false,
        conditionActivityWithinMinutes: input.conditionActivityWithinMinutes ?? null,
        isActive: input.isActive,
      } as Prisma.TeamsAutomationUncheckedUpdateInput,
      include: automationInclude,
    });

    return mapAutomation(automation as never);
  },

  async listActiveForTrigger(input: {
    trigger: "incomingWebhookReceived" | "performanceLogged" | "competitionScoreLogged";
    campaignIds?: string[];
    podIds?: string[];
  }) {
    const campaignIds = Array.from(new Set((input.campaignIds ?? []).filter(Boolean)));
    const podIds = Array.from(new Set((input.podIds ?? []).filter(Boolean)));

    const automations = await prisma.teamsAutomation.findMany({
      where: {
        trigger: input.trigger,
        mode: "event",
        isActive: true,
        OR: [
          { scope: "global" },
          ...(campaignIds.length > 0 ? [{ scope: "campaign" as const, campaignId: { in: campaignIds } }] : []),
          ...(podIds.length > 0 ? [{ scope: "pod" as const, podId: { in: podIds } }] : []),
        ],
      },
      include: automationInclude,
      orderBy: [{ name: "asc" }],
    });

    return automations.map((automation) => mapAutomation(automation as never));
  },

  async listActiveScheduled() {
    const automations = await prisma.teamsAutomation.findMany({
      where: {
        isActive: true,
        mode: {
          in: ["oneTime", "recurring"],
        },
      },
      include: automationInclude,
      orderBy: [{ name: "asc" }],
    });

    return automations.map((automation) => mapAutomation(automation as never));
  },

  async markTriggered(id: string, triggeredAt: Date) {
    await prisma.teamsAutomation.update({
      where: { id },
      data: {
        lastTriggeredAt: triggeredAt,
      },
    });
  },

  async createIncomingEvent(input: {
    endpointId: string;
    endpointName: string;
    payload: unknown;
    headers?: Record<string, string> | null;
  }) {
    const event = await prisma.teamsIncomingEvent.create({
      data: {
        endpointId: input.endpointId,
        endpointName: input.endpointName,
        payloadJson: input.payload as never,
        headersJson: (input.headers ?? null) as never,
      },
    });

    return mapIncomingEvent(event);
  },

  async listRecentIncomingEvents() {
    const events = await prisma.teamsIncomingEvent.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 20,
    });

    return events.map(mapIncomingEvent);
  },

  async countRecentActivity(input: {
    event: TeamsAutomationConditionEvent;
    since: Date;
    campaignId?: string | null;
    podId?: string | null;
  }) {
    if (input.event === "performanceLogged") {
      const where = {
        loggedAt: {
          gte: input.since,
        },
        ...(input.campaignId
          ? {
              trackerKpi: {
                campaignId: input.campaignId,
              },
            }
          : {}),
        ...(input.podId
          ? {
              user: {
                podMemberships: {
                  some: {
                    podId: input.podId,
                  },
                },
              },
            }
          : {}),
      };
      const [count, aggregate] = await Promise.all([
        prisma.trackerLog.count({ where }),
        prisma.trackerLog.aggregate({
          where,
          _sum: { value: true },
        }),
      ]);
      return {
        count,
        totalValue: aggregate._sum.value?.toNumber() ?? 0,
      };
    }

    const where = {
      updatedAt: {
        gte: input.since,
      },
      ...(input.campaignId
        ? {
            user: {
              podMemberships: {
                some: {
                  pod: {
                    campaignId: input.campaignId,
                  },
                },
              },
            },
          }
        : {}),
      ...(input.podId
        ? {
            user: {
              podMemberships: {
                some: {
                  podId: input.podId,
                },
              },
            },
          }
        : {}),
    };
    const [count, aggregate] = await Promise.all([
      prisma.competitionEntry.count({ where }),
      prisma.competitionEntry.aggregate({
        where,
        _sum: { score: true },
      }),
    ]);
    return {
      count,
      totalValue: aggregate._sum.score ?? 0,
    };
  },

  async createPendingDelivery(input: {
    automationId: string;
    title: string;
    text: string;
    facts?: Array<{ name: string; value: string }> | null;
    dueAt: Date;
  }) {
    await (prisma as any).teamsAutomationPendingDelivery.create({
      data: {
        automationId: input.automationId,
        title: input.title,
        text: input.text,
        factsJson: (input.facts ?? null) as unknown as Prisma.InputJsonValue,
        dueAt: input.dueAt,
      },
    });
  },

  async listDuePendingDeliveries(now: Date) {
    return (prisma as any).teamsAutomationPendingDelivery.findMany({
      where: {
        sentAt: null,
        dueAt: {
          lte: now,
        },
      },
      include: {
        automation: {
          select: {
            outgoingWebhookId: true,
          },
        },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    });
  },

  async markPendingDeliveriesSent(ids: string[], sentAt: Date) {
    if (ids.length === 0) {
      return;
    }

    await (prisma as any).teamsAutomationPendingDelivery.updateMany({
      where: {
        id: {
          in: ids,
        },
      },
      data: {
        sentAt,
      },
    });
  },
};
