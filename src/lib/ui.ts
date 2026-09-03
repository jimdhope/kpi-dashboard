export const DNO_COLORS: Record<string, string> = {
  "National Grid (Western Power)": "#ffa726",
  "SSEN": "#ab47bc",
  "Northern Powergrid": "#42a5f5",
  "UK Power Networks": "#ef5350",
  "SP Energy Networks": "#26c6da",
  "Electricity North West": "#9ccc65",
};

export const DEFAULT_DNO_COLOR = "#8892a6";

export function dnoColor(dno: string): string {
  return DNO_COLORS[dno] ?? DEFAULT_DNO_COLOR;
}

export type StatusKind = "live" | "planned" | "resolved" | "unknown";

export function statusKind(status: string): StatusKind {
  const s = (status || "").toLowerCase().trim();
  if (s === "planned" || (s.includes("planned") && !s.includes("unplanned"))) return "planned";
  if (s.includes("restored") || s.includes("resolved") || s.includes("fixed") || s.includes("closed") || s.includes("completed") || s === "fully_resolved") return "resolved";
  return "live";
}

export function statusLabel(status: string): string {
  const npgStatuses: Record<string, string> = {
    response_not_started: "Response Not Started", fault_logged: "Fault Logged",
    dispatching: "Dispatching Resources", engineers_en_route: "Engineers En Route",
    on_site_investigation: "On-Site Investigation", restoration_in_progress: "Restoration In Progress",
    validation_checks: "Validation / Safety Checks", fully_resolved: "Fully Resolved",
  };
  if (npgStatuses[status]) return npgStatuses[status];
  const ukpnStatuses: Record<string, string> = {
    awaiting_allocation: "Awaiting Allocation", en_route: "En Route",
    on_site: "On Site", restored: "Restored", closed: "Closed",
  };
  if (ukpnStatuses[status]) return ukpnStatuses[status];
  const ngedStatuses: Record<string, string> = {
    reported: "Reported", assigned: "Assigned", dispatched: "Dispatched", fixed: "Fixed",
  };
  if (ngedStatuses[status]) return ngedStatuses[status];
  const spenStatuses: Record<string, string> = {
    active: "Active", resolved: "Resolved", planned: "Planned",
  };
  if (spenStatuses[status]) return spenStatuses[status];
  const ssenStatuses: Record<string, string> = {
    awaiting_engineer: "Awaiting Engineer", engineer_en_route: "Engineer En Route",
    engineer_on_site: "Engineer On Site", restored: "Restored", unplanned: "Unplanned",
    fixed: "Fixed", in_progress: "In Progress", ordered: "Ordered",
  };
  if (ssenStatuses[status]) return ssenStatuses[status];
  const enwlStatuses: Record<string, string> = {
    logged: "Logged", in_progress: "In Progress", restored: "Restored",
    new: "New", dispatched: "Dispatched",
  };
  if (enwlStatuses[status]) return enwlStatuses[status];
  const kind = statusKind(status);
  if (kind === "live") return "Unplanned";
  if (kind === "planned") return "Planned";
  if (kind === "resolved") return "Restored";
  return status || "Unknown";
}

export function isLive(status: string): boolean {
  return statusKind(status) === "live";
}

export function statusColor(status: string): string {
  const kind = statusKind(status);
  if (kind === "live") return "#ef5350";
  if (kind === "planned") return "#f59e0b";
  if (kind === "resolved") return "#22c55e";
  const npgColors: Record<string, string> = {
    response_not_started: "#8892a6", fault_logged: "#ffa726", dispatching: "#f59e0b",
    engineers_en_route: "#42a5f5", on_site_investigation: "#ab47bc",
    restoration_in_progress: "#26c6da", validation_checks: "#66bb6a", fully_resolved: "#22c55e",
  };
  if (npgColors[status]) return npgColors[status];
  if (status.includes("awaiting") || status.includes("logged") || status.includes("reported")) return "#ffa726";
  if (status.includes("dispatch") || status.includes("en_route") || status.includes("assigned")) return "#42a5f5";
  if (status.includes("on_site") || status.includes("in_progress") || status.includes("active")) return "#ab47bc";
  if (status.includes("restoration") || status.includes("validation")) return "#26c6da";
  if (status.includes("restored") || status.includes("resolved") || status.includes("fixed") || status.includes("closed")) return "#22c55e";
  if (status.includes("planned")) return "#f59e0b";
  return "#8892a6";
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === "1900-01-01 00:00:00" || dateStr === "Invalid Date")
    return "Unknown";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("en-GB", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return dateStr || "Unknown";
  }
}
