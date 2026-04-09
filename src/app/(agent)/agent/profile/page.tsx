'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { generateInitials } from "@/lib/utils";
import { PasswordInput } from "@/components/ui/password-input";
import { KeyRound, Bell, Save, Loader2 } from "lucide-react";
import type { AppUser } from '@/lib/contracts';

export default function AgentProfilePage() {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setCurrentUser(data.user);
            setName(data.user.name || "");
          }
        }
      } catch (err) {
        console.error('Error fetching session:', err);
      }
      setIsLoadingUser(false);
    }
    fetchSession();
  }, []);

  const handleSave = async () => {
    if (!currentUser) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      
      if (res.ok) {
        toast({
          title: "Profile updated",
          description: "Your profile has been updated successfully.",
        });
        // Refresh session
        const sessionRes = await fetch('/api/auth/session');
        if (sessionRes.ok) {
          const data = await sessionRes.json();
          setCurrentUser(data.user);
        }
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentUser) return;

    if (!currentPassword) {
      toast({
        title: "Current Password Required",
        description: "Please enter your current password.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password Too Short",
        description: "New password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "New password and confirmation must match.",
        variant: "destructive",
      });
      return;
    }

    setIsPasswordLoading(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      
      if (res.ok) {
        toast({
          title: "Password Updated",
          description: "Your password has been changed successfully.",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update password');
      }
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast({
        title: "Password Update Failed",
        description: error.message || "Could not update your password.",
        variant: "destructive",
      });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  if (isLoadingUser) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account profile</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-xl bg-primary/20 text-primary">
                  {generateInitials(name || currentUser?.email || 'U')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{name || "Your Name"}</p>
                <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={currentUser?.email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              <div className="grid gap-2">
                <Label>Role</Label>
                <Input
                  value={currentUser?.roles?.[0] || 'Agent'}
                  disabled
                  className="bg-muted capitalize"
                />
              </div>
            </div>

            <Button onClick={handleSave} disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>
              Leave blank to keep your current password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <PasswordInput
                id="currentPassword"
                value={currentPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                disabled={isPasswordLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newPassword">New Password</Label>
              <PasswordInput
                id="newPassword"
                value={newPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                disabled={isPasswordLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                disabled={isPasswordLoading}
              />
            </div>
            <Button onClick={handlePasswordChange} disabled={isPasswordLoading} className="w-full">
              {isPasswordLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Update Password
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card variant="glass" className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </CardTitle>
          <CardDescription>
            Coming Soon
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Email and push notification preferences will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
