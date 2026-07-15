import { PermissionLevel, NavResource } from "@/lib/contracts";
import { prisma } from "@/server/db/client";

type PermissionMap = Record<string, PermissionLevel>;

export const permissionService = {
  async getPermissionsForRoles(roleKeys: string[]) {
    const perms = await prisma.rolePermission.findMany({
      where: { role: { key: { in: roleKeys as any } } },
      select: { resource: true, level: true },
    });
    const map: PermissionMap = {};
    const levelOrder: PermissionLevel[] = ["NONE", "VIEW", "MANAGE"];
    for (const permission of perms) {
      const level = permission.level as PermissionLevel;
      if (!map[permission.resource] || levelOrder.indexOf(level) > levelOrder.indexOf(map[permission.resource])) {
        map[permission.resource] = level;
      }
    }
    return map;
  },

  async hasEffectiveAdminAccess(roleKeys: string[]): Promise<boolean> {
    const permissions = await permissionService.getPermissionsForRoles(roleKeys);
    return permissions["nav.settings"] === "MANAGE";
  },

  async hasNavAccess(roleKeys: string[], resource: NavResource, minLevel: PermissionLevel = "VIEW"): Promise<boolean> {
    const perms = await permissionService.getPermissionsForRoles(roleKeys);
    const levelOrder: PermissionLevel[] = ["NONE", "VIEW", "MANAGE"];
    const granted = perms[`nav.${resource}`] ?? "NONE";
    return levelOrder.indexOf(granted) >= levelOrder.indexOf(minLevel);
  },

  async getNavLevel(roleKeys: string[], resource: NavResource): Promise<PermissionLevel> {
    const perms = await permissionService.getPermissionsForRoles(roleKeys);
    return perms[`nav.${resource}`] ?? "NONE";
  },

  async getAllPermissions() {
    const roles = await prisma.role.findMany({
      orderBy: [{ key: "asc" }],
    });
    const perms = await prisma.rolePermission.findMany();
    return { roles, permissions: perms };
  },

  async setPermission(roleId: string, resource: string, level: PermissionLevel) {
    await prisma.rolePermission.upsert({
      where: { roleId_resource: { roleId, resource } },
      create: { roleId, resource, level },
      update: { level },
    });
  },

  async setPermissionsBulk(updates: Array<{ roleId: string; resource: string; level: PermissionLevel }>) {
    for (const u of updates) {
      await permissionService.setPermission(u.roleId, u.resource, u.level);
    }
  },

  async seedDefaults() {
    const roles = await prisma.role.findMany();
    const roleMap = Object.fromEntries(roles.map((r) => [r.key, r.id]));

    const defaults: Record<string, Record<string, PermissionLevel>> = {
      admin: {
        "nav.knowledgeBase": "MANAGE",
        "nav.directory": "MANAGE",
        "nav.competitions": "MANAGE",
        "nav.performance": "MANAGE",
        "nav.reports": "MANAGE",
        "nav.miniGames": "MANAGE",
        "nav.usefulTools": "MANAGE",
        "nav.activity": "MANAGE",
        "nav.settings": "MANAGE",
        "nav.integrations": "MANAGE",
      },
      campaignManager: {
        "nav.knowledgeBase": "MANAGE",
        "nav.directory": "MANAGE",
        "nav.competitions": "MANAGE",
        "nav.performance": "MANAGE",
        "nav.reports": "MANAGE",
        "nav.miniGames": "MANAGE",
        "nav.usefulTools": "VIEW",
        "nav.activity": "MANAGE",
        "nav.settings": "MANAGE",
        "nav.integrations": "MANAGE",
      },
      podManager: {
        "nav.knowledgeBase": "MANAGE",
        "nav.directory": "MANAGE",
        "nav.competitions": "MANAGE",
        "nav.performance": "MANAGE",
        "nav.reports": "MANAGE",
        "nav.miniGames": "MANAGE",
        "nav.usefulTools": "VIEW",
        "nav.activity": "MANAGE",
        "nav.settings": "MANAGE",
        "nav.integrations": "MANAGE",
      },
      teamLeader: {
        "nav.knowledgeBase": "MANAGE",
        "nav.directory": "MANAGE",
        "nav.competitions": "MANAGE",
        "nav.performance": "VIEW",
        "nav.reports": "VIEW",
        "nav.miniGames": "VIEW",
        "nav.usefulTools": "VIEW",
        "nav.activity": "VIEW",
        "nav.settings": "MANAGE",
        "nav.integrations": "MANAGE",
      },
      competitionRunner: {
        "nav.knowledgeBase": "MANAGE",
        "nav.directory": "MANAGE",
        "nav.competitions": "MANAGE",
        "nav.performance": "VIEW",
        "nav.reports": "VIEW",
        "nav.miniGames": "VIEW",
        "nav.usefulTools": "VIEW",
        "nav.activity": "VIEW",
        "nav.settings": "MANAGE",
        "nav.integrations": "MANAGE",
      },
      agent: {
        "nav.knowledgeBase": "VIEW",
        "nav.directory": "VIEW",
        "nav.competitions": "VIEW",
        "nav.performance": "VIEW",
        "nav.reports": "NONE",
        "nav.miniGames": "VIEW",
        "nav.usefulTools": "VIEW",
        "nav.activity": "VIEW",
        "nav.settings": "NONE",
        "nav.integrations": "NONE",
      },
    };

    for (const [roleKey, resources] of Object.entries(defaults)) {
      const roleId = roleMap[roleKey];
      if (!roleId) continue;
      for (const [resource, level] of Object.entries(resources)) {
        await prisma.rolePermission.upsert({
          where: { roleId_resource: { roleId, resource } },
          create: { roleId, resource, level },
          // Defaults fill gaps without overwriting permissions configured in the UI.
          update: {},
        });
      }
    }
  },
};
