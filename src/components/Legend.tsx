"use client";

import { useMemo } from "react";
import { DNO_COLORS } from "@/lib/ui";

export function Legend({
  filter,
  onFilter,
  onHide,
}: {
  filter: string | null;
  onFilter: (dno: string | null) => void;
  onHide: () => void;
}) {
  const entries = useMemo(() => Object.entries(DNO_COLORS), []);

  return (
    <div className="absolute right-3 top-3 z-[1000] min-w-[150px] rounded-lg border border-glass-border bg-glass/80 backdrop-blur-xl p-3 text-xs text-card-foreground">
      <div className="mb-2 flex items-start justify-between">
        <h3 className="pr-6 text-sm text-primary">Distribution Network Operators</h3>
        <button
          onClick={onHide}
          aria-label="Hide legend"
          className="bg-transparent p-0 text-xs text-muted-foreground"
        >
          Hide
        </button>
      </div>
      {entries.map(([name, color]) => {
        const active = filter === name;
        return (
          <div
            key={name}
            onClick={() => onFilter(active ? null : name)}
            className="mb-1 flex cursor-pointer items-center gap-1.5"
            style={{ opacity: filter && !active ? 0.35 : 1 }}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
            <span>{name}</span>
          </div>
        );
      })}
    </div>
  );
}
