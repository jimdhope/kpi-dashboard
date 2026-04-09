import { UserRole } from "@/lib/contracts";
import { hashPassword } from "@/server/auth/password";
import { authService } from "@/server/services/auth-service";
import { activityService } from "@/server/services/activity-service";
import { userRepository } from "@/server/repositories/user-repository";
import { requireAdminUser } from "@/server/services/authorization";

export const userService = {
  async getCurrentUser() {
    return authService.requireCurrentUser();
  },

  async listUsers() {
    await authService.requireCurrentUser(); // Any authenticated user can view
    return userRepository.list();
  },

  async listUsersForMemberships() {
    await requireAdminUser();
    return userRepository.listForMemberships();
  },

  async createUser(input: {
    name: string;
    email: string;
    password: string;
    roles: UserRole[];
  }) {
    await requireAdminUser();
    return userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      roles: input.roles,
    });
  },

  async updateUser(id: string, input: { name: string; roles: UserRole[] }) {
    await requireAdminUser();
    const currentUser = await authService.requireCurrentUser();

    // Get target user for activity logging
    const targetUser = await userRepository.findById(id);
    
    const updated = await userRepository.update(id, input);

    // Determine which fields were updated
    const fieldsUpdated: string[] = [];
    if (input.name && input.name !== targetUser?.name) {
      fieldsUpdated.push('name');
    }
    // targetUser has userRoles relation, not roles array directly
    const targetRoles = targetUser?.userRoles?.map((ur) => ur.role.key as UserRole) || [];
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
    const currentUser = await requireAdminUser();
    if (currentUser.id === id) {
      throw new Error("You cannot delete the active admin session user.");
    }
    await userRepository.delete(id);
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
