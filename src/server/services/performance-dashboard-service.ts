import { kpiLogRepository } from "@/server/repositories/kpi-log-repository";
import { kpiRepository } from "@/server/repositories/kpi-repository";
import { podRepository } from "@/server/repositories/pod-repository";
import { userRepository } from "@/server/repositories/user-repository";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";

export const performanceDashboardService = {
  async getData(podId?: string) {
    const user = await authService.requireCurrentUser();
    const permissions = await permissionService.getPermissionsForRoles(user.roles);
    if (!permissions["nav.performance"] || permissions["nav.performance"] === "NONE") {
      throw new Error("Forbidden");
    }

    const hasAdminDataAccess = permissions["nav.settings"] === "MANAGE";
    const pods = await (hasAdminDataAccess ? podRepository.list() : podRepository.listForUser(user.id));
    const allowedPodIds = new Set(pods.map((pod) => pod.id));
    if (podId && !allowedPodIds.has(podId)) throw new Error("Forbidden");

    const visiblePodIds = podId ? [podId] : [...allowedPodIds];
    const [kpis, users, logs] = await Promise.all([
      kpiRepository.list(),
      hasAdminDataAccess ? userRepository.list() : userRepository.listByPodIds([...allowedPodIds]),
      hasAdminDataAccess && !podId
        ? kpiLogRepository.list()
        : kpiLogRepository.listByPodIds(visiblePodIds),
    ]);

    return { pods, kpis, users, logs };
  },
};
