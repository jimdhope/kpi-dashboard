"use client";

import dynamic from "next/dynamic";
import { Zap } from "lucide-react";

const PowerCutMap = dynamic(() => import("@/components/PowerCutMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <div className="text-center">
        <div className="text-4xl mb-2">⚡</div>
        <p>Loading map...</p>
      </div>
    </div>
  ),
});

export default function PowerCutsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Zap className="h-8 w-8 text-primary" />
          UK Power Cut Map
        </h1>
        <p className="text-muted-foreground">
          Real-time power cut incidents across the UK from all 6 Distribution Network Operators.
        </p>
      </div>
      <div className="h-[calc(100vh-14rem)] min-h-[500px] overflow-hidden rounded-xl border border-glass-border">
        <PowerCutMap />
      </div>
    </div>
  );
}
