import {
  TeamsAutomationFactTemplate,
  TeamsMessageTemplateRecord,
  TeamsChannelCategory,
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

function mapTemplate(record: {
  id: string;
  name: string;
  category: TeamsChannelCategory | null;
  version: number;
  deliveryFormat: "messageCard" | "adaptiveCard" | "adaptiveCardWithImage";
  titleTemplate: string;
  messageTemplate: string;
  factsJson: unknown;
  adaptiveCardJson: unknown;
  imageTitleTemplate: string | null;
  imageSubtitleTemplate: string | null;
  imageMetricTemplate: string | null;
  imageFooterTemplate: string | null;
  imageAccentColor: string | null;
  variationsJson: unknown;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TeamsMessageTemplateRecord {
  return {
    id: record.id,
    name: record.name,
    category: record.category,
    version: record.version,
    deliveryFormat: record.deliveryFormat,
    titleTemplate: record.titleTemplate,
    messageTemplate: record.messageTemplate,
    facts: normalizeFacts(record.factsJson),
    adaptiveCardJson: record.adaptiveCardJson ? JSON.stringify(record.adaptiveCardJson, null, 2) : null,
    imageTitleTemplate: record.imageTitleTemplate,
    imageSubtitleTemplate: record.imageSubtitleTemplate,
    imageMetricTemplate: record.imageMetricTemplate,
    imageFooterTemplate: record.imageFooterTemplate,
    imageAccentColor: record.imageAccentColor,
    variationsJson: record.variationsJson as Record<string, unknown> | null,
    isDefault: record.isDefault,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export const teamsMessageTemplateRepository = {
  async list() {
    const templates = await prisma.teamsMessageTemplate.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return templates.map((template) => mapTemplate(template as never));
  },

  async listByCategory(category?: TeamsChannelCategory) {
    const templates = await prisma.teamsMessageTemplate.findMany({
      where: category ? { category, isActive: true } : { isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return templates.map((template) => mapTemplate(template as never));
  },

  async create(input: {
    name: string;
    category?: TeamsChannelCategory | null;
    deliveryFormat: "messageCard" | "adaptiveCard" | "adaptiveCardWithImage";
    titleTemplate: string;
    messageTemplate: string;
    facts: TeamsAutomationFactTemplate[];
    adaptiveCardJson?: string | null;
    imageTitleTemplate?: string | null;
    imageSubtitleTemplate?: string | null;
    imageMetricTemplate?: string | null;
    imageFooterTemplate?: string | null;
    imageAccentColor?: string | null;
    variationsJson?: Record<string, unknown> | null;
    isDefault?: boolean;
    isActive: boolean;
  }) {
    const template = await prisma.teamsMessageTemplate.create({
      data: {
        name: input.name,
        category: input.category ?? null,
        deliveryFormat: input.deliveryFormat,
        titleTemplate: input.titleTemplate,
        messageTemplate: input.messageTemplate,
        factsJson: input.facts as unknown as Prisma.InputJsonValue,
        adaptiveCardJson: input.adaptiveCardJson ? (JSON.parse(input.adaptiveCardJson) as Prisma.InputJsonValue) : null,
        imageTitleTemplate: input.imageTitleTemplate ?? null,
        imageSubtitleTemplate: input.imageSubtitleTemplate ?? null,
        imageMetricTemplate: input.imageMetricTemplate ?? null,
        imageFooterTemplate: input.imageFooterTemplate ?? null,
        imageAccentColor: input.imageAccentColor ?? null,
        variationsJson: input.variationsJson as Prisma.InputJsonValue ?? null,
        isDefault: input.isDefault ?? false,
        isActive: input.isActive,
      } as Prisma.TeamsMessageTemplateUncheckedCreateInput,
    });

    return mapTemplate(template as never);
  },

  async update(
    id: string,
    input: {
      name: string;
      category?: TeamsChannelCategory | null;
      deliveryFormat: "messageCard" | "adaptiveCard" | "adaptiveCardWithImage";
      titleTemplate: string;
      messageTemplate: string;
      facts: TeamsAutomationFactTemplate[];
      adaptiveCardJson?: string | null;
      imageTitleTemplate?: string | null;
      imageSubtitleTemplate?: string | null;
      imageMetricTemplate?: string | null;
      imageFooterTemplate?: string | null;
      imageAccentColor?: string | null;
      variationsJson?: Record<string, unknown> | null;
      isDefault?: boolean;
      isActive: boolean;
    },
  ) {
    const current = await prisma.teamsMessageTemplate.findUniqueOrThrow({
      where: { id },
      select: { version: true },
    });

    const template = await prisma.teamsMessageTemplate.update({
      where: { id },
      data: {
        name: input.name,
        category: input.category ?? null,
        version: current.version + 1,
        deliveryFormat: input.deliveryFormat,
        titleTemplate: input.titleTemplate,
        messageTemplate: input.messageTemplate,
        factsJson: input.facts as unknown as Prisma.InputJsonValue,
        adaptiveCardJson: input.adaptiveCardJson ? (JSON.parse(input.adaptiveCardJson) as Prisma.InputJsonValue) : null,
        imageTitleTemplate: input.imageTitleTemplate ?? null,
        imageSubtitleTemplate: input.imageSubtitleTemplate ?? null,
        imageMetricTemplate: input.imageMetricTemplate ?? null,
        imageFooterTemplate: input.imageFooterTemplate ?? null,
        imageAccentColor: input.imageAccentColor ?? null,
        variationsJson: input.variationsJson as Prisma.InputJsonValue ?? null,
        isDefault: input.isDefault ?? false,
        isActive: input.isActive,
      } as Prisma.TeamsMessageTemplateUncheckedUpdateInput,
    });

    return mapTemplate(template as never);
  },

  async delete(id: string) {
    await prisma.teamsMessageTemplate.delete({ where: { id } });
  },

  async findById(id: string) {
    const template = await prisma.teamsMessageTemplate.findUnique({ where: { id } });
    return template ? mapTemplate(template as never) : null;
  },

  async clearDefaultsForCategory(category: TeamsChannelCategory) {
    await prisma.teamsMessageTemplate.updateMany({
      where: { category, isDefault: true },
      data: { isDefault: false },
    });
  },
};
