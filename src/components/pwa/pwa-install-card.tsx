"use client";

import { CheckCircle2, Download, Share } from "lucide-react";
import { usePwa } from "@/components/pwa/pwa-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PwaInstallCard() {
  const { canInstall, install, isIOS, isStandalone } = usePwa();

  return (
    <Card variant="glass" className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isStandalone ? <CheckCircle2 className="h-5 w-5 text-teal-400" /> : <Download className="h-5 w-5" />}
          Install KPI Quest
        </CardTitle>
        <CardDescription>Open KPI Quest from your home screen or desktop like a native app.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isStandalone ? (
          <p className="text-sm text-muted-foreground">KPI Quest is installed on this device.</p>
        ) : canInstall ? (
          <Button type="button" onClick={() => void install()}>
            <Download className="h-4 w-4" /> Install app
          </Button>
        ) : isIOS ? (
          <div className="flex gap-3 rounded-lg border border-white/10 bg-slate-950/25 p-4 text-sm">
            <Share className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" />
            <p>In Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Use your browser&apos;s Install app or Add to Home Screen option. Installation may be unavailable in private browsing.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          The installed app still needs an internet connection for live dashboards, games, and changes.
        </p>
      </CardContent>
    </Card>
  );
}
