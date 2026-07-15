import type { NavResource } from "@/lib/contracts";

export type PermissionRequirement = {
  resource: NavResource;
  minLevel: "VIEW" | "MANAGE";
};

export const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const LEVEL_ORDER = ["NONE", "VIEW", "MANAGE"] as const;

export function permissionLevelSatisfies(
  granted: (typeof LEVEL_ORDER)[number],
  required: PermissionRequirement["minLevel"],
) {
  return LEVEL_ORDER.indexOf(granted) >= LEVEL_ORDER.indexOf(required);
}

const PAGE_GUARDS: Array<PermissionRequirement & { prefix: string }> = [
  { prefix: "/knowledge-base/new", resource: "knowledgeBase", minLevel: "MANAGE" },
  { prefix: "/knowledge-base/categories", resource: "knowledgeBase", minLevel: "MANAGE" },
  { prefix: "/knowledge-base/tags", resource: "knowledgeBase", minLevel: "MANAGE" },
  { prefix: "/directory/contacts/new", resource: "directory", minLevel: "MANAGE" },
  { prefix: "/competitions/manage", resource: "competitions", minLevel: "MANAGE" },
  { prefix: "/competitions/log", resource: "competitions", minLevel: "MANAGE" },
  { prefix: "/competitions/certificates", resource: "competitions", minLevel: "MANAGE" },
  { prefix: "/performance/kpis", resource: "performance", minLevel: "MANAGE" },
  { prefix: "/performance/log", resource: "performance", minLevel: "MANAGE" },
  { prefix: "/admin", resource: "settings", minLevel: "MANAGE" },
  { prefix: "/settings", resource: "settings", minLevel: "MANAGE" },
  { prefix: "/reports", resource: "reports", minLevel: "VIEW" },
  { prefix: "/competitions", resource: "competitions", minLevel: "VIEW" },
  { prefix: "/performance", resource: "performance", minLevel: "VIEW" },
  { prefix: "/knowledge-base", resource: "knowledgeBase", minLevel: "VIEW" },
  { prefix: "/directory", resource: "directory", minLevel: "VIEW" },
  { prefix: "/mini-games", resource: "miniGames", minLevel: "VIEW" },
  { prefix: "/tools", resource: "usefulTools", minLevel: "VIEW" },
  { prefix: "/call-flow", resource: "usefulTools", minLevel: "VIEW" },
  { prefix: "/meter-reading-guide", resource: "usefulTools", minLevel: "VIEW" },
];

const API_GUARDS: Array<{
  prefix: string;
  pattern?: RegExp;
  resource: NavResource;
  readLevel: "VIEW" | "MANAGE";
  writeLevel: "VIEW" | "MANAGE";
}> = [
  { prefix: "/api/gamification/admin", resource: "settings", readLevel: "MANAGE", writeLevel: "MANAGE" },
  { prefix: "/api/settings", resource: "settings", readLevel: "MANAGE", writeLevel: "MANAGE" },
  { prefix: "/api/integrations", resource: "integrations", readLevel: "MANAGE", writeLevel: "MANAGE" },
  { prefix: "/api/reports", resource: "reports", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/competition-rule-templates", resource: "competitions", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/competitions", resource: "competitions", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/achievements", resource: "competitions", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/bonus-logs", resource: "competitions", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/task-logs", resource: "competitions", readLevel: "MANAGE", writeLevel: "MANAGE" },
  { prefix: "/api/kpis", resource: "performance", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/performance", resource: "performance", readLevel: "VIEW", writeLevel: "VIEW" },
  { prefix: "/api/directory", resource: "directory", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/activities", resource: "activity", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/pod-memberships", resource: "settings", readLevel: "MANAGE", writeLevel: "MANAGE" },
  { prefix: "", pattern: /^\/api\/kb\/articles\/[^/]+\/comments(?:\/|$)/, resource: "knowledgeBase", readLevel: "VIEW", writeLevel: "VIEW" },
  { prefix: "/api/kb/comments", resource: "knowledgeBase", readLevel: "VIEW", writeLevel: "VIEW" },
  { prefix: "/api/kb/articles", resource: "knowledgeBase", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/kb/categories", resource: "knowledgeBase", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/kb/tags", resource: "knowledgeBase", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/mini-games", resource: "miniGames", readLevel: "VIEW", writeLevel: "VIEW" },
  { prefix: "/api/rps-games", resource: "miniGames", readLevel: "VIEW", writeLevel: "VIEW" },
  { prefix: "/api/gamification/evaluate", resource: "miniGames", readLevel: "MANAGE", writeLevel: "MANAGE" },
  { prefix: "/api/gamification/crown", resource: "miniGames", readLevel: "MANAGE", writeLevel: "MANAGE" },
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getPagePermissionRequirement(pathname: string): PermissionRequirement | null {
  if (/^\/knowledge-base\/[^/]+\/(?:edit|history)(?:\/|$)/.test(pathname)) {
    return { resource: "knowledgeBase", minLevel: "MANAGE" };
  }
  if (/^\/directory\/contacts\/[^/]+\/edit(?:\/|$)/.test(pathname)) {
    return { resource: "directory", minLevel: "MANAGE" };
  }
  const guard = PAGE_GUARDS.find(({ prefix }) => matchesPrefix(pathname, prefix));
  return guard ? { resource: guard.resource, minLevel: guard.minLevel } : null;
}

export function getApiPermissionRequirement(pathname: string, method: string): PermissionRequirement | null {
  const guard = API_GUARDS.find(({ prefix, pattern }) =>
    pattern ? pattern.test(pathname) : matchesPrefix(pathname, prefix),
  );
  if (!guard) return null;
  return {
    resource: guard.resource,
    minLevel: SAFE_METHODS.has(method.toUpperCase()) ? guard.readLevel : guard.writeLevel,
  };
}
