import { PermissionLevel, NavResource } from "@/lib/contracts";
import { prisma } from "@/server/db/client";
import { PERMISSION_SECTIONS } from "@/lib/permission-catalog";

type PermissionMap = Record<string, PermissionLevel>;
export type DataScopeLevel = "NONE" | "ASSIGNED_PODS" | "ALL_PODS";

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
    for (const section of PERMISSION_SECTIONS) {
      // A restored/custom permission set can grant a Settings child while the
      // broad Settings entry is NONE. Treat the parent as the highest explicit
      // child level so the navigation shell remains reachable, without
      // promoting unrelated children.
      const configuredParentLevel = map[section.key] ?? "NONE";
      const highestChildLevel = section.children.reduce<PermissionLevel>((highest, child) => {
        const childLevel = map[child.key] ?? "NONE";
        return levelOrder.indexOf(childLevel) > levelOrder.indexOf(highest) ? childLevel : highest;
      }, configuredParentLevel);
      map[section.key] = highestChildLevel;
      for (const child of section.children) {
        map[child.key] = map[child.key] ?? configuredParentLevel;
      }
    }
    return map;
  },

  async hasEffectiveAdminAccess(roleKeys: string[]): Promise<boolean> {
    return roleKeys.includes("admin");
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

  async hasResourceAccess(roleKeys: string[], resource: string, minLevel: PermissionLevel = "VIEW") {
    const permissions = await permissionService.getPermissionsForRoles(roleKeys);
    const levelOrder: PermissionLevel[] = ["NONE", "VIEW", "MANAGE"];
    return levelOrder.indexOf(permissions[resource] ?? "NONE") >= levelOrder.indexOf(minLevel);
  },

  async getDataScopesForRoles(roleKeys: string[]) {
    const scopes = await prisma.roleDataScope.findMany({
      where: { role: { key: { in: roleKeys as any } } },
      select: { resource: true, level: true },
    });
    const order: DataScopeLevel[] = ["NONE", "ASSIGNED_PODS", "ALL_PODS"];
    const result: Record<string, DataScopeLevel> = {};
    for (const scope of scopes) {
      const level = scope.level as DataScopeLevel;
      if (!result[scope.resource] || order.indexOf(level) > order.indexOf(result[scope.resource])) result[scope.resource] = level;
    }
    return result;
  },

  async getAllPermissions() {
    const roles = await prisma.role.findMany({
      orderBy: [{ key: "asc" }],
    });
    const [perms, dataScopes] = await Promise.all([prisma.rolePermission.findMany(), prisma.roleDataScope.findMany()]);
    return { roles, permissions: perms, dataScopes };
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

  async setDataScopesBulk(updates: Array<{ roleId: string; resource: string; level: DataScopeLevel }>) {
    for (const update of updates) {
      await prisma.roleDataScope.upsert({
        where: { roleId_resource: { roleId: update.roleId, resource: update.resource } },
        create: update,
        update: { level: update.level },
      });
    }
  },

  async seedDefaults(overwrite = false) {
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
    const settingsChildDefaults: Record<string, Record<string, PermissionLevel>> = {
      campaignManager: { campaigns: "MANAGE", pods: "MANAGE", users: "VIEW", userAccounts: "NONE", userRoles: "NONE", podDeletion: "NONE", announcements: "NONE", feedback: "NONE", permissions: "NONE", backup: "NONE" },
      podManager: { campaigns: "NONE", pods: "VIEW", users: "MANAGE", userAccounts: "NONE", userRoles: "NONE", podDeletion: "NONE", announcements: "NONE", feedback: "NONE", permissions: "NONE", backup: "NONE" },
      teamLeader: { campaigns: "NONE", pods: "NONE", users: "MANAGE", userAccounts: "NONE", userRoles: "NONE", podDeletion: "NONE", announcements: "NONE", feedback: "NONE", permissions: "NONE", backup: "NONE" },
      competitionRunner: { campaigns: "NONE", pods: "NONE", users: "NONE", userAccounts: "NONE", userRoles: "NONE", podDeletion: "NONE", announcements: "NONE", feedback: "NONE", permissions: "NONE", backup: "NONE" },
    };
    const dataScopeDefaults: Record<string, DataScopeLevel> = {
      admin: "ALL_PODS",
      campaignManager: "ALL_PODS",
      podManager: "ASSIGNED_PODS",
      teamLeader: "ASSIGNED_PODS",
      competitionRunner: "ALL_PODS",
      agent: "ASSIGNED_PODS",
    };

    for (const [roleKey, resources] of Object.entries(defaults)) {
      const roleId = roleMap[roleKey];
      if (!roleId) continue;
      for (const [resource, level] of Object.entries(resources)) {
        await prisma.rolePermission.upsert({
          where: { roleId_resource: { roleId, resource } },
          create: { roleId, resource, level },
          // Defaults fill gaps without overwriting permissions configured in the UI.
          update: overwrite ? { level } : {},
        });
      }
      for (const section of PERMISSION_SECTIONS) {
        const level = resources[section.key] ?? "NONE";
        for (const child of section.children) {
          const settingsKey = child.key.replace("nav.settings.", "");
          const childLevel = section.key === "nav.settings"
            ? settingsChildDefaults[roleKey]?.[settingsKey] ?? level
            : level;
          await prisma.rolePermission.upsert({
            where: { roleId_resource: { roleId, resource: child.key } },
            create: { roleId, resource: child.key, level: childLevel },
            update: overwrite ? { level: childLevel } : {},
          });
        }
      }
      if (roleKey === "agent") {
        await prisma.rolePermission.upsert({
          where: { roleId_resource: { roleId, resource: "nav.activity.all" } },
          create: { roleId, resource: "nav.activity.all", level: "NONE" },
          update: { level: "NONE" },
        });
      }
      for (const resource of ["people", "competitions"]) {
        const level = dataScopeDefaults[roleKey] ?? "NONE";
        await prisma.roleDataScope.upsert({
          where: { roleId_resource: { roleId, resource } },
          create: { roleId, resource, level },
          update: overwrite ? { level } : {},
        });
      }
    }
  },
};
