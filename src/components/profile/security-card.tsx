"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Laptop, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type PasskeyItem = { id: string; name?: string | null; createdAt?: Date | string | null; deviceType?: string };
type SessionItem = { id: string; token: string; userAgent?: string | null; ipAddress?: string | null; createdAt: Date | string; expiresAt: Date | string };

export function SecurityCard() {
  const [name, setName] = useState("");
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    const [passkeyResult, sessionResult] = await Promise.all([
      authClient.passkey.listUserPasskeys(),
      authClient.listSessions(),
    ]);
    setPasskeys((passkeyResult.data ?? []) as PasskeyItem[]);
    setSessions((sessionResult.data ?? []) as SessionItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const record = (action: string) => fetch("/api/auth/security-activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Passkeys & Sessions</CardTitle>
        <CardDescription>Use Face ID, Touch ID, Windows Hello or a security key, and review devices signed into your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Passkey name, e.g. MacBook" maxLength={64} />
          <Button type="button" onClick={async () => {
            const result = await authClient.passkey.addPasskey({ name: name.trim() || undefined });
            if (result?.error) return toast({ title: "Passkey not added", description: result.error.message, variant: "destructive" });
            setName("");
            void record("passkey_added");
            await refresh();
            toast({ title: "Passkey added" });
          }}><Plus className="mr-2 h-4 w-4" />Add Passkey</Button>
        </div>

        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : passkeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No passkeys registered. Your password remains available for sign-in and recovery.</p>
        ) : (
          <div className="space-y-2">
            {passkeys.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
              <div><p className="font-medium">{item.name || "Passkey"}</p><p className="text-xs text-muted-foreground">{item.deviceType || "Authenticator"}{item.createdAt ? ` · Added ${new Date(item.createdAt).toLocaleDateString()}` : ""}</p></div>
              <div className="flex"><Button type="button" size="icon" variant="ghost" aria-label={`Rename ${item.name || "passkey"}`} onClick={async () => {
                const nextName = window.prompt("Passkey name", item.name || "Passkey")?.trim();
                if (!nextName) return;
                const result = await authClient.passkey.updatePasskey({ id: item.id, name: nextName });
                if (result.error) return toast({ title: "Could not rename passkey", description: result.error.message, variant: "destructive" });
                void record("passkey_renamed");
                await refresh();
              }}><Pencil className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" aria-label={`Remove ${item.name || "passkey"}`} onClick={async () => {
                const result = await authClient.passkey.deletePasskey({ id: item.id });
                if (result.error) return toast({ title: "Could not remove passkey", description: result.error.message, variant: "destructive" });
                void record("passkey_removed");
                await refresh();
              }}><Trash2 className="h-4 w-4" /></Button></div>
            </div>)}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between"><h3 className="font-medium">Active sessions</h3><Button type="button" variant="outline" size="sm" onClick={async () => { await authClient.revokeOtherSessions(); void record("sessions_revoked"); await refresh(); }}>Sign out other devices</Button></div>
          {sessions.map((session) => <div key={session.id} className="flex items-center justify-between rounded-lg border p-3">
            <div className="min-w-0"><p className="flex items-center gap-2 font-medium"><Laptop className="h-4 w-4" />{session.userAgent || "Unknown device"}</p><p className="truncate text-xs text-muted-foreground">{session.ipAddress || "IP unavailable"} · expires {new Date(session.expiresAt).toLocaleDateString()}</p></div>
            <Button type="button" size="icon" variant="ghost" aria-label="Revoke session" onClick={async () => { await authClient.revokeSession({ token: session.token }); void record("session_revoked"); await refresh(); }}><Trash2 className="h-4 w-4" /></Button>
          </div>)}
        </div>
      </CardContent>
    </Card>
  );
}
