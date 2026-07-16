"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OfflineRetry() {
  return (
    <Button type="button" onClick={() => window.location.reload()}>
      <RefreshCw className="h-4 w-4" /> Try again
    </Button>
  );
}
