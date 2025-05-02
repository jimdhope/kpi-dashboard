
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '@/lib/firebase'; // Import Firestore and Auth
import { AppUser } from '@/services/user'; // Import AppUser type
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save, UserCircle, Building2 } from 'lucide-react'; // Icons
import { generateInitials } from '@/lib/utils'; // Import generateInitials

// Validation Schema for Profile Update
const profileFormSchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters.' }).max(50, { message: 'Name must be 50 characters or less.' }),
  // Avatar customization (no URL, just initials and color)
  avatarInitials: z.string().max(2, { message: "Initials can be max 2 characters."}).optional(),
  avatarBgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, { message: "Color must be a valid hex code (e.g., #RRGGBB)"}).optional().or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<AppUser | null>(null);
  const [podManagerName, setPodManagerName] = useState<string | null>(null);
  const [teamLeaderName, setTeamLeaderName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      avatarInitials: '',
      avatarBgColor: '',
    },
    mode: 'onChange',
  });

  // Get current user and fetch their Firestore data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDocRef = doc(db, 'users', currentUser.uid);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const fetchedUserData = { id: userDocSnap.id, ...userDocSnap.data() } as AppUser;
            setUserData(fetchedUserData);
            // Set form defaults once data is fetched
            form.reset({
              name: fetchedUserData.name || '',
              avatarInitials: fetchedUserData.avatarInitials || '',
              avatarBgColor: fetchedUserData.avatarBgColor || '',
            });
            // TODO: Fetch Pod Manager and Team Leader names based on user's Pod/Team assignment
            // This requires knowing how users are linked to Pods (e.g., `podId` field on user)
            // For now, using placeholders:
            setPodManagerName("Jane Smith (Manager)"); // Placeholder
            setTeamLeaderName("Bob Johnson (Leader)"); // Placeholder
          } else {
            // Handle case where Firestore document doesn't exist yet (maybe first login)
            console.warn(`Firestore document for user ${currentUser.uid} not found.`);
            // Optionally create a basic document here if needed
            // For now, set form defaults from Auth user if available
            form.reset({ name: currentUser.displayName || currentUser.email || '' });
            setUserData({ uid: currentUser.uid, name: currentUser.displayName || '', email: currentUser.email || '', roles: [] }); // Basic user data
             toast({
               variant: "destructive",
               title: "Profile Data Missing",
               description: "Could not load full profile details from the database.",
             });
          }
        } catch (error) {
           console.error("Error fetching user data:", error);
           toast({
             variant: "destructive",
             title: "Error Loading Profile",
             description: "Could not load your profile information.",
           });
             // Set basic defaults even on error
             form.reset({ name: currentUser.displayName || currentUser.email || '' });
        }
      } else {
        // No user logged in, redirect or handle appropriately
        setUser(null);
        setUserData(null);
         // Consider redirecting to login: router.push('/login');
      }
      setIsLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [form, toast]); // Add form and toast to dependency array

  const onSubmit = async (data: ProfileFormData) => {
    if (!user || !userData) {
       toast({ variant: "destructive", title: "Error", description: "User not found." });
      return;
    }
    setIsSubmitting(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const updates: Partial<AppUser> = {
        name: data.name,
        avatarInitials: data.avatarInitials || '', // Save empty string if blank
        avatarBgColor: data.avatarBgColor || '', // Save empty string if blank
      };

      // Use setDoc with merge:true or updateDoc
      // setDoc is often simpler if the document might not exist yet
      await setDoc(userDocRef, updates, { merge: true });
      // Or use updateDoc if you are sure the document exists
      // await updateDoc(userDocRef, updates);

      // Update local state optimistically or re-fetch
       setUserData((prev) => prev ? { ...prev, ...updates } as AppUser : null);

      toast({
        title: "Profile Updated",
        description: "Your profile details have been saved.",
      });
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

  // Watch form values to update avatar preview
  const watchInitials = form.watch('avatarInitials');
  const watchBgColor = form.watch('avatarBgColor');
  const watchName = form.watch('name');

   const previewInitials = watchInitials || generateInitials(watchName || userData?.name || user?.email || '?');
   const previewBgColor = watchBgColor; // Use watched color directly


  if (isLoading) {
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
            <Skeleton className="h-10 w-24 rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

   if (!user) {
    // Handle case where user is definitely not logged in (e.g., show login prompt)
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
                        {/* Display preview based on form values */}
                        <AvatarFallback
                           initials={previewInitials}
                           backgroundColor={previewBgColor} // Pass custom color for preview
                        >
                           {/* Render initials */}
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
                                    <Input placeholder={generateInitials(userData?.name || '?')} {...field} disabled={isSubmitting} maxLength={2} className="max-w-xs" />
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
                                        <Input
                                            type="text"
                                            placeholder="#008080" // Example color
                                            {...field}
                                            disabled={isSubmitting}
                                            maxLength={7}
                                            className="w-32"
                                        />
                                    </FormControl>
                                    <Input
                                        type="color"
                                        value={field.value || '#008080'} // Default picker value
                                        onChange={(e) => field.onChange(e.target.value)}
                                        className="h-10 w-10 p-1 cursor-pointer"
                                        disabled={isSubmitting}
                                        title="Select background color"
                                    />
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

              {/* Display Pod Manager and Team Leader */}
                <div className="space-y-4">
                     <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Team Information</h3>
                     <div className="flex items-center gap-2">
                         <UserCircle className="h-5 w-5 text-primary" />
                         {/* Changed p to div */}
                         <div className="text-sm">
                           <strong>Pod Manager:</strong> {podManagerName || <Skeleton className="h-4 w-32 inline-block ml-1" />}
                         </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                         {/* Changed p to div */}
                         <div className="text-sm">
                           <strong>Team Leader:</strong> {teamLeaderName || <Skeleton className="h-4 w-32 inline-block ml-1" />}
                         </div>
                    </div>
                 </div>


              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSubmitting ? 'Saving...' : 'Save Profile'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

