import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";

const sessionInclude = {
  user: {
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              permissions: {
                select: {
                  resource: true,
                  level: true,
                },
              },
            },
          },
        },
      },
      podMemberships: {
        select: {
          podId: true,
        },
      },
    },
  },
} satisfies Prisma.SessionInclude;

export const sessionRepository = {
  async create(input: {
    userId: string;
    sessionTokenHash: string;
    expiresAt: Date;
  }) {
    return prisma.session.create({
      data: input,
      include: sessionInclude,
    });
  },

  async findByTokenHash(sessionTokenHash: string) {
    return prisma.session.findUnique({
      where: { sessionTokenHash },
      include: sessionInclude,
    });
  },

  async deleteByTokenHash(sessionTokenHash: string) {
    await prisma.session.deleteMany({
      where: { sessionTokenHash },
    });
  },

  async deleteByUserId(userId: string) {
    await prisma.session.deleteMany({ where: { userId } });
  },

  async deleteExpired() {
    await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  },
};
