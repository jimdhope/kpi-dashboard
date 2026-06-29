import { AppCampaign } from "@/lib/contracts";
import { prisma } from "@/server/db/client";

function mapCampaign(campaign: {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  incomingWebhookId: string | null;
  outgoingWebhookId: string | null;
  createdAt: Date;
  updatedAt: Date;
  incomingWebhook?: { name: string } | null;
  outgoingWebhook?: { name: string } | null;
}): AppCampaign {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    isActive: campaign.isActive,
    incomingWebhookId: campaign.incomingWebhookId,
    outgoingWebhookId: campaign.outgoingWebhookId,
    incomingWebhookName: campaign.incomingWebhook?.name ?? null,
    outgoingWebhookName: campaign.outgoingWebhook?.name ?? null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

export const campaignRepository = {
  async list() {
    const campaigns = await prisma.campaign.findMany({
      include: {
        incomingWebhook: {
          select: {
            name: true,
          },
        },
        outgoingWebhook: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return campaigns.map(mapCampaign);
  },

  async create(input: {
    name: string;
    description?: string | null;
    isActive: boolean;
    incomingWebhookId?: string | null;
    outgoingWebhookId?: string | null;
  }) {
    const campaign = await prisma.campaign.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        isActive: input.isActive,
        incomingWebhookId: input.incomingWebhookId ?? null,
        outgoingWebhookId: input.outgoingWebhookId ?? null,
      },
      include: {
        incomingWebhook: {
          select: {
            name: true,
          },
        },
        outgoingWebhook: {
          select: {
            name: true,
          },
        },
      },
    });

    return mapCampaign(campaign);
  },

  async update(id: string, input: {
    name: string;
    description?: string | null;
    isActive: boolean;
    incomingWebhookId?: string | null;
    outgoingWebhookId?: string | null;
  }) {
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description ?? null,
        isActive: input.isActive,
        incomingWebhookId: input.incomingWebhookId ?? null,
        outgoingWebhookId: input.outgoingWebhookId ?? null,
      },
      include: {
        incomingWebhook: {
          select: {
            name: true,
          },
        },
        outgoingWebhook: {
          select: {
            name: true,
          },
        },
      },
    });

    return mapCampaign(campaign);
  },
};
