import Image from "next/image";
import { WifiOff } from "lucide-react";
import { OfflineRetry } from "@/components/pwa/offline-retry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card variant="glass" className="w-full max-w-lg text-center">
        <CardHeader className="items-center gap-3">
          <Image src="/logo.svg" alt="KPI Quest" width={64} height={64} priority />
          <div className="rounded-full bg-amber-500/15 p-3">
            <WifiOff className="h-7 w-7 text-amber-300" />
          </div>
          <CardTitle>You&apos;re offline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">
            KPI Quest needs a connection for live dashboards, games, and changes. Reconnect and try again to continue.
          </p>
          <OfflineRetry />
        </CardContent>
      </Card>
    </main>
  );
}
