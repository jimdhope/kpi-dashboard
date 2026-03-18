'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { onAuthStateChanged, updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { generateInitials } from "@/lib/utils";
import type { AppUser } from "@/services/user";
import { onSnapshot } from "firebase/firestore";

export default function AgentProfilePage() {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = { id: docSnap.id, ...docSnap.data() } as AppUser;
            setCurrentUser(userData);
            setName(userData.name || "");
          }
          setIsLoadingUser(false);
        });
      } else {
        setIsLoadingUser(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    
    setIsLoading(true);
    try {
      await updateProfile(auth.currentUser, {
        displayName: name
      });
      
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        name: name
      });
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
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

      <Card variant="glass" className="max-w-2xl">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your profile details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-xl bg-primary/20 text-primary">
                {generateInitials(name || currentUser?.email || 'U')}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{name || "Your Name"}</p>
              <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
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

            {currentUser?.podId && (
              <div className="grid gap-2">
                <Label>Pod</Label>
                <Input
                  value={currentUser.podId}
                  disabled
                  className="bg-muted"
                />
              </div>
            )}
          </div>

          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
