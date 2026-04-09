import { prisma } from "@/server/db/client";
import { Prisma } from "@prisma/client";

export const kpiRepository = {
  async list() {
    return prisma.kpi.findMany({
      orderBy: { name: 'asc' },
    });
  },

  async getById(id: string) {
    return prisma.kpi.findUnique({
      where: { id },
    });
  },

  async create(data: {
    name: string;
    initials: string;
    type: string;
    maxValue?: number | null;
    sortOrder?: string;
    passFailCriteriaEnabled?: boolean;
    passFailOperator?: string | null;
    passFailValue?: number | null;
  }) {
    return prisma.kpi.create({
      data: {
        name: data.name,
        initials: data.initials.substring(0, 4),
        type: data.type as any,
        maxValue: data.maxValue ? new Prisma.Decimal(data.maxValue) : null,
        sortOrder: (data.sortOrder || 'desc') as any,
        passFailCriteriaEnabled: data.passFailCriteriaEnabled ?? false,
        passFailOperator: data.passFailOperator as any || null,
        passFailValue: data.passFailValue ? new Prisma.Decimal(data.passFailValue) : null,
      },
    });
  },

  async update(id: string, data: Partial<{
    name: string;
    initials: string;
    type: string;
    maxValue: number | null;
    sortOrder: string;
    passFailCriteriaEnabled: boolean;
    passFailOperator: string | null;
    passFailValue: number | null;
  }>) {
    const updateData: any = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.initials !== undefined) updateData.initials = data.initials.substring(0, 4);
    if (data.type !== undefined) updateData.type = data.type;
    if (data.maxValue !== undefined) updateData.maxValue = data.maxValue ? new Prisma.Decimal(data.maxValue) : null;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.passFailCriteriaEnabled !== undefined) updateData.passFailCriteriaEnabled = data.passFailCriteriaEnabled;
    if (data.passFailOperator !== undefined) updateData.passFailOperator = data.passFailOperator;
    if (data.passFailValue !== undefined) updateData.passFailValue = data.passFailValue ? new Prisma.Decimal(data.passFailValue) : null;

    return prisma.kpi.update({
      where: { id },
      data: updateData,
    });
  },

  async delete(id: string) {
    return prisma.kpi.delete({
      where: { id },
    });
  },
};
