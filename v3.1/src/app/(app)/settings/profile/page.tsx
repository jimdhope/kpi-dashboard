'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { generateInitials } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";

const profileFormSchema = z.object({
  name: z.string().min(2, { error: 'Name must be at least 2 characters.' }).max(50, { error: 'Name must be 50 characters or less.' }),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

interface AppUser {
  id: string;
  name?: string;
  email?: string;
}

export default function ProfileSettings() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const { toast } = useToast();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
          form.reset({
            name: data.user?.name || '',
          });
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    }
    fetchUser();
  }, [form]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!currentUser) return;
    
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, roles: [] }),
      });

      if (!res.ok) {
        throw new Error('Failed to update profile');
      }

      toast({
        title: "Profile Updated",
        description: "Your profile has been updated.",
      });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const watchName = form.watch('name');

  if (!currentUser) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Profile Settings</h1>
          <p className="text-muted-foreground">Manage your account profile</p>
        </div>
        <Card variant="glass" className="max-w-2xl">
          <CardContent className="py-8">
            <div className="space-y-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your account profile</p>
      </div>

      <Card variant="glass" className="max-w-2xl">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your profile details</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="text-xl bg-primary/20 text-primary">
                    {generateInitials(watchName || currentUser?.email || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{watchName || "Your Name"}</p>
                  <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
                </div>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your name"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={currentUser?.email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
