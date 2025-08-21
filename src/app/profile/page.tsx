'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { onAuthStateChanged, type User, updatePassword as updateAuthPassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'; // Added updateAuthPassword, reauthenticateWithCredential, EmailAuthProvider
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '@/lib/firebase';
import { AppUser } from '@/services/user';
// import type { Pod } from '@/app/(admin)/admin/pods/page'; // No longer needed
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save, KeyRound } from 'lucide-react'; // Icons - Removed UserCircle, Building2
import { generateInitials } from '@/lib/utils';
import { PasswordInput } from '@/components/ui/password-input'; // Import PasswordInput
import { Separator } from '@/components/ui/separator'; // Import Separator

// Extend validation schema for profile update including optional password change
const profileFormSchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters.' }).max(50, { message: 'Name must be 50 characters or less.' }),
  avatarInitials: z.string().max(2, { message: "Initials can be max 2 characters."}).optional(),
  avatarBgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, { message: "Color must be a valid hex code (e.g., #RRGGBB)"}).optional().or(z.literal('')),
  currentPassword: z.string().optional(), // This field is now used for re-authentication flow if password is being changed
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
})
.refine(data => {
    // If newPassword is provided, confirmPassword must also be provided and match
    if (data.newPassword) {
        return data.confirmPassword && data.newPassword === data.confirmPassword;
    }
    return true; // No validation needed if newPassword is not provided
  }, {
    message: "New passwords must match.",
    path: ['confirmPassword'], // Error shown on confirmPassword field
  })
 .refine(data => {
     // If newPassword is provided, it must meet length requirement
     if (data.newPassword) {
         return data.newPassword.length >= 6;
     }
     return true;
    }, {
     message: "New password must be at least 6 characters.",
     path: ['newPassword'],
 });


type ProfileFormData = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<AppUser | null>(null);
  // Removed state for Pod Manager and Team Leader names
  // const [podManagerName, setPodManagerName] = useState<string | null>(null);
  // const [teamLeaderName, setTeamLeaderName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      avatarInitials: '',
      avatarBgColor: '',
      currentPassword: '', // Initialize password fields
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

   // Removed fetchUserName helper as it's no longer needed for this page

   // Fetch user data
  useEffect(() => {
     setIsLoading(true);
     // Reset removed state
     // setPodManagerName(null);
     // setTeamLeaderName(null);

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDocRef = doc(db, 'users', currentUser.uid);
        console.log(`Auth state changed: Logged in user ${currentUser.uid}`);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const fetchedUserData = { id: userDocSnap.id, ...userDocSnap.data() } as AppUser;
             // Ensure uid is present, fallback to id if necessary (shouldn't happen with correct setup)
             fetchedUserData.uid = fetchedUserData.uid || fetchedUserData.id!;
            setUserData(fetchedUserData);
             console.log("Fetched user data:", fetchedUserData); // Log user data

            // Reset form with fetched user data
            form.reset({
              name: fetchedUserData.name || '',
              avatarInitials: fetchedUserData.avatarInitials || '',
              avatarBgColor: fetchedUserData.avatarBgColor || '',
              currentPassword: '', // Always clear password fields on load
              newPassword: '',
              confirmPassword: '',
            });

             // --- Removed Pod Manager and Team Leader Name Fetching Logic ---

          } else {
            console.warn(`Firestore document for user ${currentUser.uid} not found.`);
            form.reset({ name: currentUser.displayName || currentUser.email || '', avatarInitials: '', avatarBgColor: '' });
            // Ensure a minimal userData object is set even if Firestore doc is missing
            setUserData({ uid: currentUser.uid, name: currentUser.displayName || '', email: currentUser.email || '', roles: [], podId: null });
            toast({ variant: "destructive", title: "Profile Data Missing", description: "Could not load full profile details." });
             // Removed setting Pod Manager/Team Leader names
            // setPodManagerName('N/A');
            // setTeamLeaderName('N/A');
          }
        } catch (error) {
           console.error("Error fetching user data:", error);
           toast({ variant: "destructive", title: "Error Loading Profile", description: "Could not load profile." });
           form.reset({ name: currentUser.displayName || currentUser.email || '', avatarInitials: '', avatarBgColor: '' });
           setUserData({ uid: currentUser.uid, name: currentUser.displayName || '', email: currentUser.email || '', roles: [], podId: null });
            // Removed setting Pod Manager/Team Leader names
           // setPodManagerName('Error Loading');
           // setTeamLeaderName('Error Loading');
        }
      } else {
         console.log("Auth state changed: No user logged in.");
        // No user logged in
        setUser(null);
        setUserData(null);
         // Removed setting Pod Manager/Team Leader names
        // setPodManagerName(null);
        // setTeamLeaderName(null);
         // Optionally redirect: router.push('/login');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
   }, [form, toast]); // Removed fetchUserName from dependencies


  const onSubmit = async (data: ProfileFormData) => {
    if (!user || !userData) {
       toast({ variant: "destructive", title: "Error", description: "User not found." });
      return;
    }
    setIsSubmitting(true);
    let profileUpdateSuccess = false;
    let passwordUpdateSuccess = false;

    try {
      // --- Update Profile Details (Name, Avatar) ---
      const userDocRef = doc(db, 'users', user.uid);
      const profileUpdates: Partial<AppUser> = {
        name: data.name,
        avatarInitials: data.avatarInitials || '',
        avatarBgColor: data.avatarBgColor || '',
      };
      await setDoc(userDocRef, profileUpdates, { merge: true });
      setUserData((prev) => prev ? { ...prev, ...profileUpdates } as AppUser : null); // Optimistic update
      profileUpdateSuccess = true;

       // --- Update Password ---
        if (data.newPassword && data.confirmPassword) {
             console.log("Attempting password update...");
             try {
                // For client-side password updates, re-authentication is required for security.
                // This is a basic example. A better UX would be a modal asking for the password.
                 if (!data.currentPassword) {
                     toast({
                         variant: "destructive",
                         title: "Current Password Required",
                         description: "Please enter your current password to set a new one.",
                     });
                     throw new Error("Current password not provided.");
                 }
                const credential = EmailAuthProvider.credential(user.email!, data.currentPassword);
                await reauthenticateWithCredential(user, credential);

                // If re-authentication is successful, update the password
                 await updateAuthPassword(user, data.newPassword);
                 console.log("Password updated successfully in Firebase Auth.");
                 passwordUpdateSuccess = true;
                 // Clear password fields after successful update
                 form.reset({
                     ...form.getValues(), // Keep other form values
                     currentPassword: '',
                     newPassword: '',
                     confirmPassword: '',
                 });
             } catch (error: any) {
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
                 // Do not set passwordUpdateSuccess = true if it fails
             }
        } else {
            // If no new password was entered, consider it "successful" in the context of not failing
             passwordUpdateSuccess = true;
        }


      // --- Final Toast Message ---
       if (profileUpdateSuccess && passwordUpdateSuccess) {
            let description = "Your profile details have been saved.";
            if (data.newPassword) {
                description = "Your profile details and password have been updated.";
            }
           toast({ title: "Profile Updated", description: description });
       } else if (profileUpdateSuccess) {
            // Profile saved, but password failed (toast for password failure already shown)
            toast({ title: "Profile Details Updated", description: "Your basic profile details were saved, but the password change failed." });
       }
      // If profile update fails, the specific error is caught below

    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        variant: "destructive",
        title: "Error Updating Profile",
        description: error.message || "Could not save your profile changes.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const watchInitials = form.watch('avatarInitials');
  const watchBgColor = form.watch('avatarBgColor');
  const watchName = form.watch('name');

  const previewInitials = watchInitials || generateInitials(watchName || userData?.name || user?.email || '?');
  const previewBgColor = watchBgColor;

  if (isLoading) {
    // Skeleton loading state... (remains the same)
     return (
       <div className="space-y-6">
         <Card>
           <CardHeader>
             <Skeleton className="h-6 w-1/4 rounded" />
             <Skeleton className="h-4 w-1/2 rounded" />
           </CardHeader>
           <CardContent className="space-y-6">
             <div className="flex items-center gap-4">
               <Skeleton className="h-20 w-20 rounded-full" />
               <div className="space-y-2">
                 <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-4 w-24 rounded" />
               </div>
             </div>
             <Skeleton className="h-10 w-full rounded" />
             <Skeleton className="h-10 w-full rounded" />
             <Skeleton className="h-10 w-full rounded" />
             <Skeleton className="h-10 w-full rounded" />
             <Skeleton className="h-10 w-full rounded" /> {/* Password */}
             <Skeleton className="h-10 w-24 rounded" />
           </CardContent>
         </Card>
       </div>
     );
  }

   if (!user) {
    // User not logged in state... (remains the same)
     return (
       <div className="flex justify-center items-center h-full">
         <p>Please <a href="/login" className="underline text-primary">log in</a> to view your profile.</p>
       </div>
     );
   }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My Profile</CardTitle>
          <CardDescription>Update your personal details and preferences.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
               {/* Avatar Preview and Customization */}
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <div className="flex-shrink-0">
                  <Label>Avatar Preview</Label>
                  <Avatar className="h-24 w-24 mt-2">
                    <AvatarFallback
                      initials={previewInitials}
                      backgroundColor={previewBgColor}
                      key={previewInitials + previewBgColor} // Add key to force re-render on change
                    >
                      {previewInitials}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-grow space-y-4">
                  <FormField
                    control={form.control}
                    name="avatarInitials"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Initials (Optional)</FormLabel>
                        <FormDescription>Max 2 chars. Uses your name if blank.</FormDescription>
                        <FormControl>
                          <Input placeholder={generateInitials(userData?.name || '?')} {...field} value={field.value ?? ''} disabled={isSubmitting} maxLength={2} className="max-w-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="avatarBgColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Background Color (Optional)</FormLabel>
                        <FormDescription>Uses a random color if blank.</FormDescription>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input type="text" placeholder="#008080" {...field} value={field.value ?? ''} disabled={isSubmitting} maxLength={7} className="w-32" />
                          </FormControl>
                          <Input type="color" value={field.value || '#008080'} onChange={(e) => field.onChange(e.target.value)} className="h-10 w-10 p-1 cursor-pointer" disabled={isSubmitting} title="Select background color" />
                          <div className="h-10 w-10 rounded-md border" style={{ backgroundColor: field.value || 'transparent' }} title="Color Preview" />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Name Field */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your Name" {...field} disabled={isSubmitting}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Display Email (Read-only) */}
              <div className="space-y-2">
                 <Label>Email Address</Label>
                 <Input value={user?.email || 'Loading...'} readOnly disabled className="bg-muted/50"/>
                 <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
              </div>

               {/* Removed Team Information Section */}

              <Separator />

               {/* Password Change Section */}
               <div className="space-y-4">
                   <h3 className="text-lg font-semibold flex items-center gap-2"><KeyRound className="h-5 w-5"/>Change Password</h3>
                   <p className="text-sm text-muted-foreground">
                       Leave the fields below blank to keep your current password.
                   </p>
                   {/* Current password field for re-authentication */}
                   <FormField
                       control={form.control}
                       name="currentPassword"
                       render={({ field }) => (
                           <FormItem>
                           <FormLabel>Current Password</FormLabel>
                            <FormDescription>Required to set a new password.</FormDescription>
                           <FormControl>
                               <PasswordInput placeholder="Enter your current password" {...field} disabled={isSubmitting} />
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
                               <PasswordInput placeholder="Min. 6 characters" {...field} disabled={isSubmitting} />
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
                               <PasswordInput placeholder="Re-enter new password" {...field} disabled={isSubmitting} />
                           </FormControl>
                           <FormMessage />
                           </FormItem>
                       )}
                       />
               </div>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSubmitting ? 'Saving...' : 'Save Profile'}
              </Button>
            </form>
          </Form>
        </CardContent>
         {/* Optional Footer */}
         {/* <CardFooter>
            <p className="text-xs text-muted-foreground">Last updated: ...</p>
         </CardFooter> */}
      </Card>
    </div>
  );
}
