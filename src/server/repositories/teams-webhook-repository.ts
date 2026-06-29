import { TeamsChannelCategory, TeamsWebhookRecord, TeamsWebhookDirection } from "@/lib/contracts";
import { prisma } from "@/server/db/client";

function mapWebhook(record: {
  id: string;
  name: string;
  friendlyName: string | null;
  direction: TeamsWebhookDirection;
  url: string;
  description: string | null;
  category: TeamsChannelCategory | null;
  testStatus: string | null;
  lastTestedAt: Date | null;
  lastPostAt?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TeamsWebhookRecord {
  return {
    id: record.id,
    name: record.name,
    friendlyName: record.friendlyName,
    direction: record.direction,
    url: record.url,
    description: record.description,
    category: record.category,
    lastPostAt: record.lastPostAt?.toISOString() ?? null,
    testStatus: record.testStatus,
    lastTestedAt: record.lastTestedAt?.toISOString() ?? null,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export const teamsWebhookRepository = {
  async list() {
    const webhooks = await prisma.teamsWebhookEndpoint.findMany({
      orderBy: [{ direction: "asc" }, { name: "asc" }],
    });

    return webhooks.map(mapWebhook);
  },

  async create(input: {
    name: string;
    friendlyName?: string | null;
    direction: TeamsWebhookDirection;
    url: string;
    description?: string | null;
    category?: TeamsChannelCategory | null;
    isActive: boolean;
  }) {
    if (input.url.length > 2000) {
      throw new Error("Webhook URL exceeds maximum length");
    }
    
    const webhook = await prisma.teamsWebhookEndpoint.create({
      data: {
        name: input.name,
        friendlyName: input.friendlyName ?? null,
        direction: input.direction,
        url: input.url,
        description: input.description ?? null,
        category: input.category ?? null,
        isActive: input.isActive,
      },
    });

    return mapWebhook(webhook);
  },

  async update(
    id: string,
    input: {
      name: string;
      friendlyName?: string | null;
      direction: TeamsWebhookDirection;
      url: string;
      description?: string | null;
      category?: TeamsChannelCategory | null;
      isActive: boolean;
    },
  ) {
    const webhook = await prisma.teamsWebhookEndpoint.update({
      where: { id },
      data: {
        name: input.name,
        friendlyName: input.friendlyName ?? null,
        direction: input.direction,
        url: input.url,
        description: input.description ?? null,
        category: input.category ?? null,
        isActive: input.isActive,
      },
    });

    return mapWebhook(webhook);
  },

  async listActiveByIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }

    const webhooks = await prisma.teamsWebhookEndpoint.findMany({
      where: {
        id: {
          in: ids,
        },
        isActive: true,
      },
      orderBy: [{ name: "asc" }],
    });

    return webhooks.map(mapWebhook);
  },

  async findActiveIncomingById(id: string) {
    return prisma.teamsWebhookEndpoint.findFirst({
      where: {
        id,
        direction: "incoming",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        direction: true,
        url: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async getIncomingScopeContext(endpointId: string) {
    const [campaigns, pods] = await Promise.all([
      prisma.campaign.findMany({
        where: { incomingWebhookId: endpointId },
        select: {
          id: true,
          name: true,
        },
      }),
      prisma.pod.findMany({
        where: { incomingWebhookId: endpointId },
        select: {
          id: true,
          name: true,
          campaignId: true,
          campaign: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);

    return {
      campaigns,
      pods,
    };
  },

  async findById(id: string) {
    const webhook = await prisma.teamsWebhookEndpoint.findUnique({
      where: { id },
    });
    return webhook ? mapWebhook(webhook) : null;
  },

  async updateTestStatus(id: string, status: "success" | "failed") {
    const webhook = await prisma.teamsWebhookEndpoint.update({
      where: { id },
      data: {
        testStatus: status,
        lastTestedAt: new Date(),
      },
    });
    return mapWebhook(webhook);
  },

  async updateLastPostAt(id: string) {
    const webhook = await prisma.teamsWebhookEndpoint.update({
      where: { id },
      data: {
        lastPostAt: new Date(),
      },
    });
    return mapWebhook(webhook);
  },

  async delete(id: string) {
    await prisma.teamsWebhookEndpoint.delete({
      where: { id },
    });
  },
};
