import { AppPod } from "@/lib/contracts";
import { prisma } from "@/server/db/client";

function mapPod(pod: {
  id: string;
  campaignId: string | null;
  teamLeaderId: string | null;
  podManagerId: string | null;
  incomingWebhookId: string | null;
  outgoingWebhookId: string | null;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  campaign: { name: string } | null;
  incomingWebhook: { name: string } | null;
  outgoingWebhook: { name: string } | null;
  memberships: {
    id: string;
    user: {
      id: string;
      name: string;
      email: string;
      userRoles: {
        role: {
          key: string;
        };
      }[];
    };
  }[];
}): AppPod {
  return {
    id: pod.id,
    campaignId: pod.campaignId,
    campaignName: pod.campaign?.name ?? null,
    teamLeaderId: pod.teamLeaderId,
    podManagerId: pod.podManagerId,
    incomingWebhookId: pod.incomingWebhookId,
    outgoingWebhookId: pod.outgoingWebhookId,
    incomingWebhookName: pod.incomingWebhook?.name ?? null,
    outgoingWebhookName: pod.outgoingWebhook?.name ?? null,
    name: pod.name,
    description: pod.description,
    memberCount: pod.memberships.length,
    members: pod.memberships.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      roles: membership.user.userRoles.map((entry) => entry.role.key as AppPod["members"][number]["roles"][number]),
    })),
    createdAt: pod.createdAt.toISOString(),
    updatedAt: pod.updatedAt.toISOString(),
  };
}

export const podRepository = {
  async listPodIdsForUser(userId: string) {
    const memberships = await prisma.podMembership.findMany({
      where: { userId },
      select: {
        podId: true,
      },
    });

    return Array.from(new Set(memberships.map((membership) => membership.podId)));
  },

  async listForUser(userId: string): Promise<AppPod[]> {
    const pods = await prisma.pod.findMany({
      where: {
        OR: [
          { memberships: { some: { userId } } },
          { podManagerId: userId },
          { teamLeaderId: userId },
        ],
      },
      include: {
        campaign: {
          select: {
            name: true,
          },
        },
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
        memberships: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                userRoles: {
                  select: {
                    role: {
                      select: {
                        key: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ name: "asc" }],
    });

    return pods.map(mapPod);
  },

  async listOutgoingWebhookIdsForUser(userId: string) {
    const memberships = await prisma.podMembership.findMany({
      where: { userId },
      select: {
        pod: {
          select: {
            outgoingWebhookId: true,
          },
        },
      },
    });

    return Array.from(
      new Set(
        memberships
          .map((membership) => membership.pod.outgoingWebhookId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
  },

  async list() {
    const pods = await prisma.pod.findMany({
      include: {
        campaign: {
          select: {
            name: true,
          },
        },
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
        memberships: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                userRoles: {
                  select: {
                    role: {
                      select: {
                        key: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ name: "asc" }],
    });

    return pods.map(mapPod);
  },

  async create(input: {
    campaignId?: string | null;
    incomingWebhookId?: string | null;
    outgoingWebhookId?: string | null;
    teamLeaderId?: string | null;
    podManagerId?: string | null;
    name: string;
    description?: string | null;
  }) {
    const pod = await prisma.pod.create({
      data: {
        campaignId: input.campaignId ?? null,
        incomingWebhookId: input.incomingWebhookId ?? null,
        outgoingWebhookId: input.outgoingWebhookId ?? null,
        teamLeaderId: input.teamLeaderId ?? null,
        podManagerId: input.podManagerId ?? null,
        name: input.name,
        description: input.description ?? null,
      },
      include: {
        campaign: {
          select: {
            name: true,
          },
        },
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
        memberships: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                userRoles: {
                  select: {
                    role: {
                      select: {
                        key: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return mapPod(pod);
  },

  async update(id: string, input: {
    campaignId?: string | null;
    incomingWebhookId?: string | null;
    outgoingWebhookId?: string | null;
    teamLeaderId?: string | null;
    podManagerId?: string | null;
    name: string;
    description?: string | null;
  }) {
    const pod = await prisma.pod.update({
      where: { id },
      data: {
        campaignId: input.campaignId ?? null,
        incomingWebhookId: input.incomingWebhookId ?? null,
        outgoingWebhookId: input.outgoingWebhookId ?? null,
        teamLeaderId: input.teamLeaderId ?? null,
        podManagerId: input.podManagerId ?? null,
        name: input.name,
        description: input.description ?? null,
      },
      include: {
        campaign: {
          select: {
            name: true,
          },
        },
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
        memberships: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                userRoles: {
                  select: {
                    role: {
                      select: {
                        key: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return mapPod(pod);
  },

  async replaceMemberships(podId: string, userIds: string[]) {
    await prisma.$transaction(async (tx) => {
      await tx.podMembership.deleteMany({
        where: { podId },
      });

      if (userIds.length > 0) {
        await tx.podMembership.createMany({
          data: userIds.map((userId) => ({
            podId,
            userId,
          })),
          skipDuplicates: true,
        });
      }
    });

    const pod = await prisma.pod.findUniqueOrThrow({
      where: { id: podId },
      include: {
        campaign: {
          select: {
            name: true,
          },
        },
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
        memberships: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                userRoles: {
                  select: {
                    role: {
                      select: {
                        key: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return mapPod(pod);
  },

  async delete(id: string) {
    await prisma.pod.delete({
      where: { id },
    });
  },
};
