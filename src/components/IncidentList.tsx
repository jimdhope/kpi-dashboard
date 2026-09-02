"use client";

import type { Incident } from "@/lib/types";
import { statusLabel, statusKind, formatDate, dnoColor } from "@/lib/ui";
import { useState } from "react";

export function IncidentList({
  incidents,
  loading,
  error,
  onSelect,
  onShowLegend,
  onSearch,
}: {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  onSelect: (i: Incident) => void;
  onShowLegend: () => void;
  onSearch: (q: string) => void;
}) {
  const [searchValue, setSearchValue] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const sorted = [...incidents]
    .filter((i) => showResolved ? true : statusKind(i.status) !== "resolved")
    .sort((a, b) => {
      const dateA = a.startedAt || "";
      const dateB = b.startedAt || "";
      if (dateA && dateB) return dateB.localeCompare(dateA);
      return (b.customersAffected || 0) - (a.customersAffected || 0);
    });

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-l border-glass-border bg-glass/50 backdrop-blur-xl md:w-[420px] md:min-w-[420px]">
      <div className="shrink-0 border-b border-glass-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-card-foreground">Incidents</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{incidents.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchValue.trim()) {
                e.preventDefault();
                onSearch(searchValue.trim());
              }
            }}
            placeholder="Postcode, DNO, area..."
            className="flex-1 rounded border border-glass-border bg-muted px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            autoComplete="off"
          />
          <button
            onClick={() => searchValue.trim() && onSearch(searchValue.trim())}
            disabled={!searchValue.trim()}
            className="rounded bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            Go
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-glass-border">
        <button
          onClick={() => setShowResolved(!showResolved)}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium transition-colors ${
            showResolved
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-muted text-muted-foreground border border-glass-border"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${showResolved ? "bg-green-400" : "bg-muted-foreground"}`} />
          {showResolved ? "Hide resolved" : "Show resolved (24h)"}
        </button>
        <button
          onClick={() => {
            setSearchValue("");
            onSearch("");
          }}
          className="rounded border border-glass-border px-2 py-1 text-[0.7rem] text-muted-foreground"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {loading && sorted.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-2xl">📡</div>
            <p className="mt-1 text-xs">Loading incidents...</p>
          </div>
        )}
        {error && sorted.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-2xl">⚠️</div>
            <p className="mt-1 text-xs">Failed to load. Retrying...</p>
          </div>
        )}
        {!loading && !error && sorted.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-2xl">📭</div>
            <p className="mt-1 text-xs">No active incidents found</p>
          </div>
        )}
        {sorted.map((inc) => {
          const cls = statusKind(inc.status);
          const est = inc.estRestoration ? formatDate(inc.estRestoration) : "—";
          const cust = (inc.customersAffected ?? 0) > 0 ? inc.customersAffected : "—";
          const started = inc.startedAt ? formatDate(inc.startedAt) : "—";
          const lastUpdated = inc.updatedAt ? formatDate(inc.updatedAt) : "";
          const location = [inc.town, inc.area].filter(Boolean).join(", ") || "";
          const postcodes = (inc.postcode || "").split(";").map(p => p.trim()).filter(Boolean);
          const displayPostcode = postcodes.length > 3 
            ? postcodes.slice(0, 3).join("; ") + ` (+${postcodes.length - 3} more)`
            : postcodes.join("; ") || "—";
          const dnoClr = dnoColor(inc.dno);
          const statusClr = cls === "live" ? "#ef5350" : cls === "planned" ? "#f59e0b" : "#22c55e";

          return (
            <div
              key={`${inc.reference || inc.postcode}`}
              onClick={() => onSelect(inc)}
              className="cursor-pointer rounded-lg border border-glass-border bg-glass/50 backdrop-blur-xl p-3 hover:border-primary transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[0.65rem] font-semibold text-white"
                  style={{ backgroundColor: dnoClr }}
                >
                  {inc.dno}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-white"
                  style={{ backgroundColor: statusClr }}
                >
                  {statusLabel(inc.status)}
                </span>
              </div>
              <div className="mb-2">
                <div className="font-mono text-xs text-primary truncate" title={inc.postcode || ""}>
                  {displayPostcode}
                </div>
                {location && (
                  <div className="text-[0.7rem] text-muted-foreground truncate">{location}</div>
                )}
              </div>
              <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground">
                <div>
                  <span>Started:</span>{" "}
                  <span className="text-foreground">{started}</span>
                  {lastUpdated && (
                    <div className="text-[0.65rem] text-muted-foreground/70">Upd: {lastUpdated}</div>
                  )}
                </div>
                <div className="text-right">
                  <div>
                    <span>Cust:</span>{" "}
                    <span className="font-semibold text-primary">{cust}</span>
                  </div>
                  <div>
                    <span>Est:</span>{" "}
                    <span className="text-foreground">{est}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
