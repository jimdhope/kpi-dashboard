"use client";

import dynamic from "next/dynamic";

const PowerCutMap = dynamic(() => import("@/components/PowerCutMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-background text-muted-foreground">
      <div className="text-center">
        <div className="text-4xl mb-2">⚡</div>
        <p>Loading map...</p>
      </div>
    </div>
  ),
});

export default function PowerCutsPage() {
  return (
    <div className="h-[calc(100vh-6rem)] w-full overflow-hidden bg-background">
      <PowerCutMap />
    </div>
  );
}
