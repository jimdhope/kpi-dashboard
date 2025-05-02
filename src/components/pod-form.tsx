
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
import type { Pod } from '@/app/(admin)/admin/pods/page'; // Keep Pod type
import type { AppUser } from '@/services/user'; // Import AppUser type
import type { Campaign } from '@/app/(admin)/admin/campaigns/page'; // Import Campaign type
import { Loader2 } from 'lucide-react';
import { PasswordInput } from './ui/password-input'; // Import PasswordInput
import Image from 'next/image'; // Import Image for preview

// Define the maximum file size (e.g., 2MB)
const MAX_FILE_SIZE = 2 * 1024 * 1024;
// Define accepted image types
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];


// Define the validation schema using Zod
// Ensure IDs are non-empty strings if selected, or handle 'create_new'
// Add conditional validation for user creation fields
// Add file validation for logo
const podFormSchema = z.object({
  name: z.string().min(3, { message: 'Pod name must be at least 3 characters.' }).max(50, { message: 'Pod name must be 50 characters or less.' }),
  logoFile: z
    .custom<FileList>()
    .optional()
    .refine((files) => !files || files.length === 0 || files[0]?.size <= MAX_FILE_SIZE, `Max file size is 2MB.`)
    .refine(
      (files) => !files || files.length === 0 || ACCEPTED_IMAGE_TYPES.includes(files[0]?.type),
      "Only .jpg, .jpeg, .png, .webp and .gif formats are supported."
    ),
  logoUrl: z.string().optional(), // Keep for initial data and display
  campaignId: z.string().min(1, { message: 'Please select a campaign.' }),
  podManagerId: z.string().min(1, { message: 'Please select or create a Pod Manager.' }),
  teamLeaderId: z.string().min(1, { message: 'Please select or create a Team Leader.' }),

  // Fields for creating a new Pod Manager (optional)
  createPodManagerName: z.string().optional(),
  createPodManagerEmail: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')), // Allow empty string for optional
  createPodManagerPassword: z.string().min(6, { message: "Password must be at least 6 characters."}).optional().or(z.literal('')),

  // Fields for creating a new Team Leader (optional)
  createTeamLeaderName: z.string().optional(),
  createTeamLeaderEmail: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')), // Allow empty string for optional
  createTeamLeaderPassword: z.string().min(6, { message: "Password must be at least 6 characters."}).optional().or(z.literal('')),
}).superRefine((data, ctx) => {
    // Validate Pod Manager creation fields if 'create_new' is selected
    if (data.podManagerId === 'create_new') {
        if (!data.createPodManagerName) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Manager name is required.', path: ['createPodManagerName'] });
        }
        if (!data.createPodManagerEmail) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Manager email is required.', path: ['createPodManagerEmail'] });
        }
         if (!data.createPodManagerPassword) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Manager password is required.', path: ['createPodManagerPassword'] });
        } else if (data.createPodManagerPassword.length < 6) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Manager password must be at least 6 characters.', path: ['createPodManagerPassword'] });
        }
    }
     // Validate Team Leader creation fields if 'create_new' is selected
     if (data.teamLeaderId === 'create_new') {
        if (!data.createTeamLeaderName) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Leader name is required.', path: ['createTeamLeaderName'] });
        }
        if (!data.createTeamLeaderEmail) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Leader email is required.', path: ['createTeamLeaderEmail'] });
        }
         if (!data.createTeamLeaderPassword) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Leader password is required.', path: ['createTeamLeaderPassword'] });
         } else if (data.createTeamLeaderPassword.length < 6) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Leader password must be at least 6 characters.', path: ['createTeamLeaderPassword'] });
        }
    }
});


// Type for form data based on the schema
export type PodFormData = Omit<z.infer<typeof podFormSchema>, 'logoFile'> & {
  logoFile?: File | null;
  logoUrl?: string;
};

interface PodFormProps {
  onSubmit: (data: PodFormData, file?: File) => Promise<void> | void; // Pass file separately
  onCancel: () => void;
  initialData?: Pod; // Optional initial data for editing
  campaigns: Campaign[];
  users: AppUser[]; // Use AppUser type
}

export function PodForm({ onSubmit, onCancel, initialData, campaigns, users }: PodFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(initialData?.logoUrl || null);

    const form = useForm<z.infer<typeof podFormSchema>>({
        resolver: zodResolver(podFormSchema),
        defaultValues: {
            name: initialData?.name || '',
            logoUrl: initialData?.logoUrl || '',
            logoFile: undefined,
            campaignId: initialData?.campaignId || '',
            podManagerId: initialData?.podManagerId || '',
            teamLeaderId: initialData?.teamLeaderId || '',
            // Initialize create user fields
            createPodManagerName: '',
            createPodManagerEmail: '',
            createPodManagerPassword: '',
            createTeamLeaderName: '',
            createTeamLeaderEmail: '',
            createTeamLeaderPassword: '',
        },
        mode: 'onChange', // Validate on change for better UX with conditional fields
    });

    // Watch selected IDs to conditionally show/hide creation forms
    const watchPodManagerId = form.watch('podManagerId');
    const watchTeamLeaderId = form.watch('teamLeaderId');
    const logoFileWatch = form.watch('logoFile');

    useEffect(() => {
        // Handle logo preview
        if (logoFileWatch && logoFileWatch.length > 0) {
            const file = logoFileWatch[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else if (!initialData?.logoUrl) {
            setPreviewUrl(null);
        } else {
             setPreviewUrl(initialData.logoUrl);
        }
    }, [logoFileWatch, initialData?.logoUrl]);

  // Reset form if initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        logoUrl: initialData.logoUrl,
        logoFile: undefined,
        campaignId: initialData.campaignId,
        podManagerId: initialData.podManagerId,
        teamLeaderId: initialData.teamLeaderId,
         // Clear creation fields when editing existing pod
         createPodManagerName: '',
         createPodManagerEmail: '',
         createPodManagerPassword: '',
         createTeamLeaderName: '',
         createTeamLeaderEmail: '',
         createTeamLeaderPassword: '',
      });
       setPreviewUrl(initialData.logoUrl || null);
    } else {
        // Reset for add mode
        form.reset({
            name: '',
            logoUrl: '',
            logoFile: undefined,
            campaignId: '',
            podManagerId: '',
            teamLeaderId: '',
            createPodManagerName: '',
            createPodManagerEmail: '',
            createPodManagerPassword: '',
            createTeamLeaderName: '',
            createTeamLeaderEmail: '',
            createTeamLeaderPassword: '',
        });
         setPreviewUrl(null);
    }
  }, [initialData, form]);

   const handleFormSubmit = async (data: z.infer<typeof podFormSchema>) => {
        setIsSubmitting(true);
        const file = data.logoFile?.[0] ?? null;

        // Prepare data to submit, excluding the FileList
        const submitData: PodFormData = {
            name: data.name,
            campaignId: data.campaignId,
            podManagerId: data.podManagerId,
            teamLeaderId: data.teamLeaderId,
            createPodManagerName: data.createPodManagerName,
            createPodManagerEmail: data.createPodManagerEmail,
            createPodManagerPassword: data.createPodManagerPassword,
            createTeamLeaderName: data.createTeamLeaderName,
            createTeamLeaderEmail: data.createTeamLeaderEmail,
            createTeamLeaderPassword: data.createTeamLeaderPassword,
            logoUrl: initialData?.logoUrl, // Pass existing URL for potential deletion/update
        };

        try {
            await onSubmit(submitData, file || undefined); // Call the onSubmit passed from parent
            // Don't reset form here, let parent decide based on success/failure
        } catch (error) {
             console.error("Error during form submission process:", error);
             // Error handling should be primarily in the parent's onSubmit
        } finally {
             setIsSubmitting(false);
        }
    };

  // Filter users based on potential roles (adapt as needed)
  // TODO: Implement proper role filtering when roles are defined in the User type/Firestore
  const potentialManagers = users; //.filter(u => u.role === 'podManager' || u.role === 'admin');
  const potentialLeaders = users; //.filter(u => u.role === 'teamLeader' || u.role === 'podManager');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="grid gap-4 py-4">
        {/* Pod Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pod Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Alpha Pod" {...field} disabled={isSubmitting}/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Logo Upload */}
        <FormField
            control={form.control}
            name="logoFile"
            render={({ field: { onChange, value, ...rest } }) => (
                <FormItem>
                    <FormLabel>Logo (Optional)</FormLabel>
                    <FormControl>
                        <Input
                            type="file"
                            accept={ACCEPTED_IMAGE_TYPES.join(',')}
                            disabled={isSubmitting}
                            {...rest}
                            onChange={(e) => {
                                onChange(e.target.files); // Update form state with FileList
                            }}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />

         {/* Logo Preview */}
         {previewUrl && (
             <FormItem>
                <FormLabel>Preview</FormLabel>
                <div >
                    <Image
                    src={previewUrl}
                    alt="Logo preview"
                    width={64}
                    height={64}
                    className="rounded-md border"
                     data-ai-hint="logo preview"
                    />
                </div>
             </FormItem>
         )}


        {/* Campaign Selection */}
        <FormField
          control={form.control}
          name="campaignId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Campaign</FormLabel>
               <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={isSubmitting}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
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
               <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={isSubmitting}>
                 <FormControl>
                   <SelectTrigger>
                     <SelectValue placeholder="Select or Create Manager" />
                   </SelectTrigger>
                 </FormControl>
                 <SelectContent>
                    <SelectItem value="create_new">-- Create New Manager --</SelectItem>
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

         {/* --- Create New Pod Manager Fields (Conditional) --- */}
         {watchPodManagerId === 'create_new' && (
            <div className="pl-4 border-l-2 border-primary ml-2 space-y-3 mt-2 mb-4 pt-2 pb-3">
                 <p className="text-sm font-medium text-primary">Create New Pod Manager</p>
                 <FormField
                    control={form.control}
                    name="createPodManagerName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Manager Name</FormLabel>
                        <FormControl><Input placeholder="Full Name" {...field} disabled={isSubmitting}/></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                 />
                <FormField
                    control={form.control}
                    name="createPodManagerEmail"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Manager Email</FormLabel>
                        <FormControl><Input type="email" placeholder="email@example.com" {...field} disabled={isSubmitting}/></FormControl>
                         <FormMessage />
                        </FormItem>
                    )}
                 />
                 <FormField
                    control={form.control}
                    name="createPodManagerPassword"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Temporary Password</FormLabel>
                         {/* Use PasswordInput component */}
                        <FormControl><PasswordInput placeholder="Min. 6 characters" {...field} disabled={isSubmitting}/></FormControl>
                         <FormMessage />
                        </FormItem>
                    )}
                 />
            </div>
         )}


         {/* Team Leader Selection */}
        <FormField
          control={form.control}
          name="teamLeaderId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team Leader</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={isSubmitting}>
                 <FormControl>
                   <SelectTrigger>
                     <SelectValue placeholder="Select or Create Leader" />
                   </SelectTrigger>
                 </FormControl>
                 <SelectContent>
                    <SelectItem value="create_new">-- Create New Leader --</SelectItem>
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

        {/* --- Create New Team Leader Fields (Conditional) --- */}
         {watchTeamLeaderId === 'create_new' && (
            <div className="pl-4 border-l-2 border-primary ml-2 space-y-3 mt-2 mb-4 pt-2 pb-3">
                 <p className="text-sm font-medium text-primary">Create New Team Leader</p>
                  <FormField
                    control={form.control}
                    name="createTeamLeaderName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Leader Name</FormLabel>
                        <FormControl><Input placeholder="Full Name" {...field} disabled={isSubmitting}/></FormControl>
                         <FormMessage />
                        </FormItem>
                    )}
                 />
                 <FormField
                    control={form.control}
                    name="createTeamLeaderEmail"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Leader Email</FormLabel>
                        <FormControl><Input type="email" placeholder="email@example.com" {...field} disabled={isSubmitting}/></FormControl>
                         <FormMessage />
                        </FormItem>
                    )}
                 />
                <FormField
                    control={form.control}
                    name="createTeamLeaderPassword"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Temporary Password</FormLabel>
                         <FormControl><PasswordInput placeholder="Min. 6 characters" {...field} disabled={isSubmitting}/></FormControl>
                         <FormMessage />
                        </FormItem>
                    )}
                 />
            </div>
         )}


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

    
