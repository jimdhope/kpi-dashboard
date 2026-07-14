import { Prisma, RoleKey } from "@prisma/client";
import { AppUser, PodMembershipOption, UserRole } from "@/lib/contracts";
import { prisma } from "@/server/db/client";

const userInclude = {
  userRoles: {
    include: {
      role: true,
    },
  },
  podMemberships: {
    select: {
      podId: true,
    },
  },
} satisfies Prisma.UserInclude;

type UserRecord = Prisma.UserGetPayload<{
  include: typeof userInclude;
}>;

function mapUser(record: UserRecord): AppUser {
  const podIds = [...new Set([
    ...record.podMemberships.map((membership) => membership.podId),
    ...(record.podId ? [record.podId] : []),
  ])];

  return {
    id: record.id,
    firebaseUid: record.firebaseUid,
    email: record.email,
    name: record.name,
    roles: record.userRoles.map((entry) => entry.role.key as UserRole),
    podIds,
    avatarUrl: record.avatarUrl,
    avatarInitials: record.avatarInitials,
    avatarBgColor: record.avatarBgColor,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export const userRepository = {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: userInclude,
    });
  },

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: userInclude,
    });
  },

  async findPasswordHashById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        passwordHash: true,
      },
    });

    return user?.passwordHash ?? null;
  },

  async list() {
    const users = await prisma.user.findMany({
      include: {
        ...userInclude,
        podMemberships: {
          select: {
            podId: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return users.map((user) => {
      const mapped = mapUser(user);
      return {
        ...mapped,
        podIds: user.podMemberships.map((m) => m.podId),
      };
    });
  },

  async listByPodIds(podIds: string[]) {
    const users = await prisma.user.findMany({
      where: {
        podMemberships: {
          some: {
            podId: { in: podIds },
          },
        },
      },
      include: {
        ...userInclude,
        podMemberships: {
          select: {
            podId: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return users.map((user) => {
      const mapped = mapUser(user);
      return {
        ...mapped,
        podIds: user.podMemberships.map((m) => m.podId),
      };
    });
  },

  async listForMemberships(): Promise<PodMembershipOption[]> {
    const users = await prisma.user.findMany({
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        podMemberships: {
          select: {
            podId: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.userRoles.map((entry) => entry.role.key as UserRole),
      podIds: user.podMemberships.map((membership) => membership.podId),
    }));
  },

  async create(input: {
    name: string;
    email: string;
    passwordHash: string;
    roles: UserRole[];
  }) {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        userRoles: {
          create: input.roles.map((role) => ({
            role: {
              connect: {
                key: role as RoleKey,
              },
            },
          })),
        },
      },
      include: userInclude,
    });

    return mapUser(user);
  },

  async update(id: string, input: { name: string; roles: UserRole[] }) {
    const user = await prisma.user.update({
      where: { id },
      data: {
        name: input.name,
        userRoles: {
          deleteMany: {},
          create: input.roles.map((role) => ({
            role: {
              connect: {
                key: role as RoleKey,
              },
            },
          })),
        },
      },
      include: userInclude,
    });

    return mapUser(user);
  },

  async updateProfile(id: string, input: { name: string }) {
    const user = await prisma.user.update({
      where: { id },
      data: {
        name: input.name,
      },
      include: userInclude,
    });

    return mapUser(user);
  },

  async updatePassword(id: string, passwordHash: string) {
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
      },
    });
  },

  async delete(id: string) {
    await prisma.user.delete({
      where: { id },
    });
  },

  mapUser,
};
