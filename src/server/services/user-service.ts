import { UserRole } from "@/lib/contracts";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/server/db/client";
import { authService } from "@/server/services/auth-service";
import { activityService } from "@/server/services/activity-service";
import { userRepository } from "@/server/repositories/user-repository";
import { requireResourceAccess } from "@/server/services/authorization";
import { permissionService } from "@/server/services/permission-service";
import { getManagedPodIds, requireManagedUser } from "@/server/services/organization-scope-service";

export const userService = {
  async getCurrentUser() {
    return authService.requireCurrentUser();
  },

  async listUsers() {
    const currentUser = await authService.requireCurrentUser();
    const managedPodIds = await getManagedPodIds(currentUser, "people");
    const visiblePodIds = managedPodIds?.length === 0 ? currentUser.podIds ?? [] : managedPodIds;
    return visiblePodIds === null ? userRepository.list() : userRepository.listByPodIds(visiblePodIds);
  },

  async listUsersForMemberships() {
    await requireResourceAccess("nav.settings.pods", "MANAGE");
    return userRepository.listForMemberships();
  },

  async createUser(input: {
    name: string;
    email: string;
    password: string;
    roles: UserRole[];
  }) {
    const actor = await requireResourceAccess("nav.settings.userAccounts", "MANAGE");
    await requireResourceAccess("nav.settings.userRoles", "MANAGE");
    if (await getManagedPodIds(actor, "people") !== null) throw new Error("Forbidden");
    return userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      roles: input.roles,
    });
  },

  async updateUser(id: string, input: { name: string; roles: UserRole[] }) {
    const actor = await authService.requireCurrentUser();
    const actorPermissions = await permissionService.getPermissionsForRoles(actor.roles);
    if (actorPermissions["nav.settings.userAccounts"] !== "MANAGE" && actorPermissions["nav.settings.userRoles"] !== "MANAGE") {
      throw new Error("Forbidden");
    }

    // Get target user for activity logging
    const targetUser = await userRepository.findById(id);
    if (!targetUser) throw new Error("User not found.");
    const targetRoles = targetUser.userRoles.map((ur) => ur.role.key as UserRole);
    await requireManagedUser(actor, id);
    if (input.name !== targetUser.name) await requireResourceAccess("nav.settings.userAccounts", "MANAGE");
    if (JSON.stringify([...input.roles].sort()) !== JSON.stringify([...targetRoles].sort())) {
      await requireResourceAccess("nav.settings.userRoles", "MANAGE");
    }
    
    const updated = await userRepository.update(id, input);

    // Determine which fields were updated
    const fieldsUpdated: string[] = [];
    if (input.name && input.name !== targetUser?.name) {
      fieldsUpdated.push('name');
    }
    // targetUser has userRoles relation, not roles array directly
    if (input.roles && JSON.stringify(input.roles) !== JSON.stringify(targetRoles)) {
      fieldsUpdated.push('roles');
    }

    // Log activity if fields were updated
    if (fieldsUpdated.length > 0) {
      await activityService.logProfileUpdated({
        fieldsUpdated,
        userId: id,
        userName: targetUser?.name || 'Unknown User',
      });
    }

    return updated;
  },

  async deleteUser(id: string) {
    const currentUser = await requireResourceAccess("nav.settings.userAccounts", "MANAGE");
    if (currentUser.id === id) {
      throw new Error("You cannot delete the active admin session user.");
    }
    await requireManagedUser(currentUser, id);
    await userRepository.delete(id);
  },

  async resetPassword(id: string, password: string) {
    const currentUser = await authService.requireCurrentUser();
    const canManageUsers = await permissionService.hasResourceAccess(currentUser.roles, "nav.settings.users", "MANAGE");
    if (!canManageUsers) throw new Error("Forbidden");
    if (currentUser.id === id) {
      throw new Error("Use your Profile page to change your own password.");
    }
    const targetUser = await userRepository.findById(id);
    if (!targetUser) throw new Error("User not found.");
    const hasGlobalPeopleScope = (await permissionService.getDataScopesForRoles(currentUser.roles))["people"] === "ALL_PODS";
    if (!hasGlobalPeopleScope) {
      const sharedAssignedPod = await prisma.pod.count({
        where: {
          OR: [{ podManagerId: currentUser.id }, { teamLeaderId: currentUser.id }],
          memberships: { some: { userId: id } },
        },
      });
      if (!sharedAssignedPod) throw new Error("Forbidden");
    }

    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.account.updateMany({
        where: { userId: id, providerId: "credential" },
        data: { password: passwordHash },
      }),
      prisma.user.update({ where: { id }, data: { mustChangePassword: true } }),
      prisma.session.deleteMany({ where: { userId: id } }),
      prisma.verification.deleteMany({ where: { identifier: { contains: targetUser.email.toLowerCase() } } }),
    ]);
    await activityService.logRecorderAction({
      agentId: id,
      agentName: targetUser.name,
      type: "profile_updated",
      title: "Password Reset",
      description: "Password was reset by a manager. Existing sessions were ended.",
      metadata: { fieldsUpdated: ["password"] },
    });
  },

  async updateCurrentProfile(input: { name: string }) {
    const currentUser = await authService.requireCurrentUser();

    // Get existing user for comparison
    const existingUser = await userRepository.findById(currentUser.id);

    const updated = await userRepository.updateProfile(currentUser.id, input);

    // Log activity
    if (input.name && input.name !== existingUser?.name) {
      await activityService.logProfileUpdated({
        fieldsUpdated: ['name'],
        userId: currentUser.id,
        userName: currentUser.name,
      });
    }

    return updated;
  },
};
