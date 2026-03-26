import { UserRole } from "@/lib/contracts";
import { hashPassword } from "@/server/auth/password";
import { authService } from "@/server/services/auth-service";
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
    return userRepository.update(id, input);
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
    return userRepository.updateProfile(currentUser.id, input);
  },
};
