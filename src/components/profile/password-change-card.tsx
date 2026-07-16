"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/hooks/use-toast";
import { authClient } from "@/lib/auth-client";

export function PasswordChangeCard({ className, onSuccess }: { className?: string; onSuccess?: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const changePassword = async () => {
    if (!currentPassword) {
      toast({ title: "Current password required", description: "Enter your current password.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Your new password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", description: "New password and confirmation must match.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      if (result.error) throw new Error(result.error.message || "Failed to change password.");
      const finalize = await fetch("/api/auth/password-changed", { method: "POST" });
      if (!finalize.ok) throw new Error("Password changed, but the account status could not be refreshed. Sign in again.");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated", description: "Your password has been changed. Other signed-in sessions have been ended." });
      onSuccess?.();
    } catch (error) {
      toast({ title: "Password update failed", description: error instanceof Error ? error.message : "Could not change your password.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card variant="glass" className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Change Password</CardTitle>
        <CardDescription>Confirm your current password before choosing a new one.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2"><Label htmlFor="profile-current-password">Current Password</Label><PasswordInput id="profile-current-password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={isSubmitting} /></div>
        <div className="grid gap-2"><Label htmlFor="profile-new-password">New Password</Label><PasswordInput id="profile-new-password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" disabled={isSubmitting} /></div>
        <div className="grid gap-2"><Label htmlFor="profile-confirm-password">Confirm New Password</Label><PasswordInput id="profile-confirm-password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={isSubmitting} /></div>
        <Button type="button" onClick={changePassword} disabled={isSubmitting} className="w-full">
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</> : <><KeyRound className="mr-2 h-4 w-4" />Update Password</>}
        </Button>
      </CardContent>
    </Card>
  );
}
