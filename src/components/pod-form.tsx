
'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import type { Pod, User } from '@/app/(admin)/admin/pods/page'; // Import Pod and User types
import type { Campaign } from '@/app/(admin)/admin/campaigns/page'; // Import Campaign type
import { Loader2 } from 'lucide-react';

// Define the validation schema using Zod
// Ensure IDs are non-empty strings if selected
const podFormSchema = z.object({
  name: z.string().min(3, { message: 'Pod name must be at least 3 characters.' }).max(50, { message: 'Pod name must be 50 characters or less.' }),
  logoUrl: z.string().url({ message: 'Please enter a valid URL for the logo.' }).or(z.literal('')),
  campaignId: z.string().min(1, { message: 'Please select a campaign.' }),
  podManagerId: z.string().min(1, { message: 'Please select a Pod Manager.' }),
  teamLeaderId: z.string().min(1, { message: 'Please select a Team Leader.' }),
  // TODO: Add fields for potentially creating new users (optional)
  // createPodManagerName: z.string().optional(),
  // createPodManagerEmail: z.string().email().optional(),
  // createTeamLeaderName: z.string().optional(),
  // createTeamLeaderEmail: z.string().email().optional(),
});

// Type for form data based on the schema
export type PodFormData = z.infer<typeof podFormSchema>;

interface PodFormProps {
  onSubmit: (data: PodFormData) => Promise<void> | void;
  onCancel: () => void;
  initialData?: Pod; // Optional initial data for editing
  campaigns: Campaign[];
  users: User[]; // Pass the list of users
}

export function PodForm({ onSubmit, onCancel, initialData, campaigns, users }: PodFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const form = useForm<PodFormData>({
        resolver: zodResolver(podFormSchema),
        defaultValues: {
        name: initialData?.name || '',
        logoUrl: initialData?.logoUrl || '', // Default to empty, handle placeholder in submit logic
        campaignId: initialData?.campaignId || '',
        podManagerId: initialData?.podManagerId || '',
        teamLeaderId: initialData?.teamLeaderId || '',
        // Initialize create user fields if added
        // createPodManagerName: '',
        // createPodManagerEmail: '',
        // createTeamLeaderName: '',
        // createTeamLeaderEmail: '',
        },
    });

  // Reset form if initialData changes
  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        logoUrl: initialData.logoUrl || '',
        campaignId: initialData.campaignId,
        podManagerId: initialData.podManagerId,
        teamLeaderId: initialData.teamLeaderId,
      });
    } else {
        form.reset({
            name: '',
            logoUrl: '',
            campaignId: '',
            podManagerId: '',
            teamLeaderId: '',
        });
    }
  }, [initialData, form]);

   const handleSubmit = async (data: PodFormData) => {
        setIsSubmitting(true);
        try {
            // Handle potential user creation logic here before submitting pod data
            // For example, if createPodManagerName and createPodManagerEmail are filled,
            // call a function to create the user in Firebase Auth and Firestore, get the ID,
            // and use that ID for data.podManagerId. Similar logic for team leader.
            // This requires significant changes to user management structure.

            // Use placeholder logo if URL is empty
             const finalData = {
                ...data,
                logoUrl: data.logoUrl || `https://picsum.photos/seed/${data.name.replace(/\s+/g, '-').toLowerCase()}/40`,
             };

            await onSubmit(finalData);
            form.reset(); // Reset form after successful submission
        } catch (error) {
            // Error handling is likely done in the parent component's onSubmit
             console.error("Error during form submission process:", error);
        } finally {
             setIsSubmitting(false);
        }
    };

  // Filter users based on potential roles (adapt as needed)
  // TODO: Implement proper role filtering when roles are defined in the User type/Firestore
  const potentialManagers = users; //.filter(u => u.role === 'podManager' || u.role === 'admin');
  const potentialLeaders = users; //.filter(u => u.role === 'teamLeader' || u.role === 'podManager'); // Managers could also be leaders?

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4 py-4">
        {/* Pod Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pod Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Alpha Pod" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Logo URL */}
        <FormField
          control={form.control}
          name="logoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo URL (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://example.com/pod-logo.png"
                   {...field}
                   />
              </FormControl>
               <FormMessage />
            </FormItem>
          )}
        />
        {/* TODO: Add file upload later */}

        {/* Campaign Selection */}
        <FormField
          control={form.control}
          name="campaignId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Campaign</FormLabel>
               <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                    <SelectItem value="" disabled>Select a campaign</SelectItem>
                    {campaigns.length === 0 && <SelectItem value="loading" disabled>Loading campaigns...</SelectItem>}
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Pod Manager Selection */}
        <FormField
          control={form.control}
          name="podManagerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pod Manager</FormLabel>
               {/* TODO: Add option to create new user */}
               <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                 <FormControl>
                   <SelectTrigger>
                     <SelectValue placeholder="Select a Pod Manager" />
                   </SelectTrigger>
                 </FormControl>
                 <SelectContent>
                    <SelectItem value="" disabled>Select a Pod Manager</SelectItem>
                    {/* <SelectItem value="create_new">-- Create New Manager --</SelectItem> */}
                     {potentialManagers.length === 0 && <SelectItem value="loading" disabled>Loading users...</SelectItem>}
                     {potentialManagers.map((user) => (
                         <SelectItem key={user.id} value={user.id}>
                            {user.name} ({user.email}) {/* Display email for clarity */}
                         </SelectItem>
                     ))}
                 </SelectContent>
               </Select>
              <FormMessage />
            </FormItem>
          )}
        />
         {/* TODO: Show fields to create new manager if 'create_new' is selected */}
         {/* {form.watch('podManagerId') === 'create_new' && ( ... fields for name/email ... )} */}


         {/* Team Leader Selection */}
        <FormField
          control={form.control}
          name="teamLeaderId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team Leader</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                 <FormControl>
                   <SelectTrigger>
                     <SelectValue placeholder="Select a Team Leader" />
                   </SelectTrigger>
                 </FormControl>
                 <SelectContent>
                    <SelectItem value="" disabled>Select a Team Leader</SelectItem>
                    {/* <SelectItem value="create_new">-- Create New Leader --</SelectItem> */}
                     {potentialLeaders.length === 0 && <SelectItem value="loading" disabled>Loading users...</SelectItem>}
                     {potentialLeaders.map((user) => (
                         <SelectItem key={user.id} value={user.id}>
                             {user.name} ({user.email})
                         </SelectItem>
                     ))}
                 </SelectContent>
               </Select>
              <FormMessage />
            </FormItem>
          )}
        />
         {/* TODO: Show fields to create new leader if 'create_new' is selected */}


          <DialogFooter>
             <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                    Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                 {isSubmitting ? 'Saving...' : 'Save Pod'}
              </Button>
          </DialogFooter>
      </form>
    </Form>
  );
}
