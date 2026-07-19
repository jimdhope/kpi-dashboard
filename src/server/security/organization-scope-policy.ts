export type OrganizationScope = "none" | "assigned" | "global";

export function resolveOrganizationScope(level: "NONE" | "ASSIGNED_PODS" | "ALL_PODS" | undefined): OrganizationScope {
  if (level === "ALL_PODS") return "global";
  if (level === "ASSIGNED_PODS") return "assigned";
  return "none";
}
