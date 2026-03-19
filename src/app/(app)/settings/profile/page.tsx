'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { getAuth, updateProfile, onAuthStateChanged, updatePassword as updateAuthPassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { generateInitials } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { PasswordInput } from "@/components/ui/password-input";
import { Separator } from "@/components/ui/separator";
import { KeyRound, Save, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const profileFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }).max(50, { message: 'Name must be 50 characters or less.' }),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine(data => {
  if (data.newPassword) {
    return data.confirmPassword && data.newPassword === data.confirmPassword;
  }
  return true;
}, { message: "New passwords must match.", path: ['confirmPassword'] })
.refine(data => {
  if (data.newPassword) {
    return data.newPassword.length >= 6;
  }
  return true;
}, { message: "New password must be at least 6 characters.", path: ['newPassword'] });

type ProfileFormData = z.infer<typeof profileFormSchema>;

export default function ProfileSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        form.reset({
          name: user.displayName || '',
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      }
    });
    return () => unsubscribe();
  }, [form]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!currentUser) return;
    
    setIsSubmitting(true);
    let profileUpdateSuccess = false;
    let passwordUpdateSuccess = true;

    try {
      const auth = getAuth();
      
      await updateProfile(currentUser, {
        displayName: data.name
      });
      
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: data.name
      });
      
      profileUpdateSuccess = true;

      if (data.newPassword && data.confirmPassword) {
        try {
          if (!data.currentPassword) {
            toast({
              variant: "destructive",
              title: "Current Password Required",
              description: "Please enter your current password to set a new one.",
            });
            throw new Error("Current password not provided.");
          }
          const credential = EmailAuthProvider.credential(currentUser.email, data.currentPassword);
          await reauthenticateWithCredential(currentUser, credential);
          await updateAuthPassword(currentUser, data.newPassword);
          passwordUpdateSuccess = true;
          form.reset({
            ...form.getValues(),
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
          });
        } catch (error: any) {
          passwordUpdateSuccess = false;
          console.error("Error updating password:", error);
          if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            toast({
              variant: "destructive",
              title: "Authentication Failed",
              description: "The current password you entered is incorrect.",
            });
          } else if (error.code === 'auth/requires-recent-login') {
            toast({
              variant: "destructive",
              title: "Re-authentication Required",
              description: "For security, please log out and log back in to change your password.",
              duration: 7000,
            });
          } else {
            toast({
              variant: "destructive",
              title: "Password Update Failed",
              description: error.message || "Could not update your password.",
            });
          }
        }
      }

      if (profileUpdateSuccess && passwordUpdateSuccess) {
        let description = "Your profile has been updated.";
        if (data.newPassword) {
          description = "Your profile and password have been updated.";
        }
        toast({
          title: "Profile Updated",
          description: description,
        });
      } else if (profileUpdateSuccess && !passwordUpdateSuccess) {
        toast({
          title: "Profile Details Updated",
          description: "Your basic profile details were saved, but the password change failed.",
        });
      }
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

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <KeyRound className="h-5 w-5"/>
                  Change Password
                </h3>
                <p className="text-sm text-muted-foreground">
                  Leave the fields below blank to keep your current password.
                </p>
                
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormDescription>Required to set a new password.</FormDescription>
                      <FormControl>
                        <PasswordInput 
                          placeholder="Enter your current password" 
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <PasswordInput 
                          placeholder="Min. 6 characters" 
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <PasswordInput 
                          placeholder="Re-enter new password" 
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
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
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
