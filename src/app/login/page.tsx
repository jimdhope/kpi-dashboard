'use client';

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn } from "lucide-react";
import { KeyRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import type { SessionPayload } from "@/lib/contracts";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function offerPasskeyAutofill() {
      if (typeof PublicKeyCredential === "undefined" || !PublicKeyCredential.isConditionalMediationAvailable) return;
      if (!await PublicKeyCredential.isConditionalMediationAvailable()) return;
      const result = await authClient.signIn.passkey({ autoFill: true });
      if (!active || result?.error) return;
      void fetch("/api/auth/security-activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "passkey_used" }) });
      router.replace("/dashboard");
      router.refresh();
    }
    void offerPasskeyAutofill();
    return () => { active = false; };
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      setLoading(false);
      setError("Invalid email or password.");
      return;
    }
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    const payload = await response.json() as SessionPayload;
    const redirectTo = payload.user?.mustChangePassword ? "/change-password" : "/dashboard";
    router.replace(redirectTo);
    router.refresh();
    return;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Image 
              src="/logo.svg" 
              alt="KPI Quest Logo" 
              width={120} 
              height={120} 
              className="w-28 h-28"
              unoptimized
            />
          </div>
          <CardTitle className="text-2xl font-bold">Login to KPI Quest</CardTitle>
          <CardDescription>Enter your credentials below</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="ml-auto inline-block text-xs underline"
                >
                  Forgot your password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="********"
                autoComplete="current-password webauthn"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              {loading ? 'Signing in...' : 'Login'}
            </Button>
            <div className="relative py-1 text-center text-xs text-muted-foreground before:absolute before:left-0 before:right-0 before:top-1/2 before:border-t">
              <span className="relative bg-card px-2">or</span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                setError(null);
                const result = await authClient.signIn.passkey({ autoFill: false });
                if (result?.error) {
                  setError(result.error.message || "Passkey sign-in was not completed.");
                  setLoading(false);
                  return;
                }
                void fetch("/api/auth/security-activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "passkey_used" }) });
                router.replace("/dashboard");
                router.refresh();
              }}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              Sign in with a passkey
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-center text-sm text-muted-foreground">
          Need help? Contact support.
        </CardFooter>
      </Card>
    </div>
  );
}
