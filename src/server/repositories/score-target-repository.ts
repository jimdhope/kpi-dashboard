import { prisma } from "@/server/db/client";

export const scoreTargetRepository = {
  async list() {
    const targets = await prisma.scoreTarget.findMany({
      orderBy: { name: "asc" },
    });
    return targets;
  },

  async listActive() {
    const targets = await prisma.scoreTarget.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return targets;
  },

  async findByHashtag(hashtag: string) {
    const normalized = hashtag.toLowerCase().replace(/^#/, "");
    const target = await prisma.scoreTarget.findUnique({
      where: { hashtag: normalized },
    });
    return target;
  },

  async create(input: {
    hashtag: string;
    name: string;
    targetType: "competition" | "tracker";
    competitionId?: string | null;
    trackerKpiId?: string | null;
    defaultPoints?: number;
    isActive?: boolean;
  }) {
    const normalized = input.hashtag.toLowerCase().replace(/^#/, "");
    const target = await prisma.scoreTarget.create({
      data: {
        hashtag: normalized,
        name: input.name,
        targetType: input.targetType,
        competitionId: input.competitionId,
        trackerKpiId: input.trackerKpiId,
        defaultPoints: input.defaultPoints ?? 1,
        isActive: input.isActive ?? true,
      },
    });
    return target;
  },

  async update(
    id: string,
    input: {
      hashtag?: string;
      name?: string;
      targetType?: "competition" | "tracker";
      competitionId?: string | null;
      trackerKpiId?: string | null;
      defaultPoints?: number;
      isActive?: boolean;
    }
  ) {
    const updateData: Record<string, unknown> = { ...input };
    if (input.hashtag) {
      updateData.hashtag = input.hashtag.toLowerCase().replace(/^#/, "");
    }
    const target = await prisma.scoreTarget.update({
      where: { id },
      data: updateData,
    });
    return target;
  },

  async delete(id: string) {
    await prisma.scoreTarget.delete({ where: { id } });
  },
};