"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { usePwa } from "@/components/pwa/pwa-provider";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "kpiq-pwa-install-dismissed-at";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export function PwaInstallHint() {
  const { canInstall, install, isIOS, isStandalone } = usePwa();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    setDismissed(Date.now() - dismissedAt < THIRTY_DAYS);
  }, []);

  if (dismissed || isStandalone || (!canInstall && !isIOS)) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <div className="mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-2xl items-center gap-3 rounded-xl border border-teal-400/20 bg-slate-950/85 px-4 py-3 shadow-xl backdrop-blur-xl">
      <Download className="h-5 w-5 shrink-0 text-teal-400" />
      <p className="min-w-0 flex-1 text-sm">
        {isIOS && !canInstall ? "Add KPI Quest to your Home Screen from Safari's Share menu." : "Install KPI Quest for quick access from this device."}
      </p>
      {canInstall ? <Button size="sm" onClick={() => void install()}>Install</Button> : null}
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={dismiss} aria-label="Dismiss install suggestion">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
