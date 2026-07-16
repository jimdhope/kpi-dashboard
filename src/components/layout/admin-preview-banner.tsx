"use client";

import { useState } from "react";
import { Eye, Loader2, X } from "lucide-react";
import type { AdminPreviewContext } from "@/lib/contracts";
import { Button } from "@/components/ui/button";

const ukTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function AdminPreviewBanner({ preview }: { preview: AdminPreviewContext }) {
  const [isExiting, setIsExiting] = useState(false);

  async function exitPreview() {
    setIsExiting(true);
    try {
      await fetch("/api/admin-preview", { method: "DELETE" });
    } finally {
      window.location.assign("/settings/users");
    }
  }

  return (
    <div className="sticky top-0 z-40 border-b border-amber-400/40 bg-amber-950/95 px-4 py-2 text-amber-50 shadow-lg backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Previewing as <strong>{preview.target.name}</strong>
            <span className="ml-2 text-amber-200">Read-only · ends at {ukTimeFormatter.format(new Date(preview.expiresAt))}</span>
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={exitPreview} disabled={isExiting} className="border-amber-300/50 bg-amber-950 hover:bg-amber-900">
          {isExiting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
          Exit preview
        </Button>
      </div>
    </div>
  );
}
