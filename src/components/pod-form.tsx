
'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'; // Import RadioGroup
import { ScrollArea } from '@/components/ui/scroll-area'; // Import ScrollArea
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
  FormDescription,
} from '@/components/ui/form';
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import type { Pod } from '@/app/(admin)/admin/pods/page'; // Keep Pod type
import type { AppUser } from '@/services/user'; // Import AppUser type
import type { Campaign } from '@/app/(admin)/admin/campaigns/page'; // Import Campaign type
import { Loader2 } from 'lucide-react';
import { PasswordInput } from './ui/password-input';


// Define the validation schema using Zod
const podFormSchema = z.object({
  name: z.string().min(3, { message: 'Pod name must be at least 3 characters.' }).max(50, { message: 'Pod name must be 50 characters or less.' }),
  logoType: z.enum(['url', 'custom'], { required_error: "Please select a logo type."}), // Radio button value
  logoUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')), // Optional URL
  logoInitials: z.string().max(2, { message: "Initials can be max 2 characters."}).optional(), // Optional custom initials (max 2 chars)
  logoBgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, { message: "Color must be a valid hex code (e.g., #RRGGBB)"}).optional().or(z.literal('')), // Optional hex color
  campaignId: z.string().min(1, { message: 'Please select a campaign.' }),
  podManagerId: z.string().min(1, { message: 'Please select or create a Pod Manager.' }),
  teamLeaderId: z.string().min(1, { message: 'Please select or create a Team Leader.' }),

  // Fields for creating a new Pod Manager (optional)
  createPodManagerName: z.string().optional(),
  createPodManagerEmail: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')), // Allow empty string for optional
  createPodManagerPassword: z.string().optional(), // Password optional overall, required conditionally

  // Fields for creating a new Team Leader (optional)
  createTeamLeaderName: z.string().optional(),
  createTeamLeaderEmail: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')), // Allow empty string for optional
  createTeamLeaderPassword: z.string().optional(), // Password optional overall, required conditionally
}).superRefine((data, ctx) => {
    // Require logoUrl if logoType is 'url'
    if (data.logoType === 'url' && !data.logoUrl) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Logo URL is required when "Use Logo URL" is selected.',
            path: ['logoUrl'],
         });
    }
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
export type PodFormData = z.infer<typeof podFormSchema>;


interface PodFormProps {
  onSubmit: (data: PodFormData) => Promise<void> | void;
  onCancel: () => void;
  initialData?: Pod; // Optional initial data for editing
  campaigns: Campaign[];
  users: AppUser[]; // Use AppUser type
}

export function PodForm({ onSubmit, onCancel, initialData, campaigns, users }: PodFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

     // Determine initial logo type based on existing data
    const getInitialLogoType = (): 'url' | 'custom' => {
        if (initialData?.logoUrl) {
            return 'url';
        }
        return 'custom'; // Default to custom if no URL
    };


    const form = useForm<PodFormData>({
        resolver: zodResolver(podFormSchema),
        defaultValues: {
            name: initialData?.name || '',
            logoType: getInitialLogoType(), // Use helper
            logoUrl: initialData?.logoUrl || '',
            logoInitials: initialData?.logoInitials || '',
            logoBgColor: initialData?.logoBgColor || '',
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

    // Watch selected IDs and logo type
    const watchPodManagerId = form.watch('podManagerId');
    const watchTeamLeaderId = form.watch('teamLeaderId');
    const watchLogoType = form.watch('logoType');


  // Reset form if initialData changes (for edit mode)
  useEffect(() => {
    const initialType = getInitialLogoType();
    if (initialData) {
      form.reset({
        name: initialData.name,
        logoType: initialType,
        logoUrl: initialData.logoUrl || '',
        logoInitials: initialData.logoInitials || '',
        logoBgColor: initialData.logoBgColor || '',
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
    } else {
        // Reset for add mode
        form.reset({
            name: '',
            logoType: 'custom', // Default to custom for new
            logoUrl: '',
            logoInitials: '',
            logoBgColor: '',
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
    }
  }, [initialData, form]);

   const handleFormSubmit = async (data: PodFormData) => {
        setIsSubmitting(true);

         // Clear unused logo fields based on selection
         const submitData = {
            ...data,
             logoUrl: data.logoType === 'url' ? data.logoUrl || '' : '',
             logoInitials: data.logoType === 'custom' ? data.logoInitials || '' : '',
             logoBgColor: data.logoType === 'custom' ? data.logoBgColor || '' : '',
         };

        try {
            await onSubmit(submitData); // Call the onSubmit passed from parent
        } catch (error) {
             console.error("Error during form submission process:", error);
        } finally {
             setIsSubmitting(false);
        }
    };

  // Filter users based on potential roles (adapt as needed)
  // Consider adding role filtering later if needed, for now use all users
  const potentialManagers = users;
  const potentialLeaders = users;


  return (
    <Form {...form}>
     {/* Use ScrollArea to make the form content scrollable */}
      <ScrollArea className="h-[65vh] pr-6"> {/* Adjust height as needed */}
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="grid gap-4 py-4 pl-2 pr-1">
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

             {/* Logo Type Selection */}
            <FormField
                control={form.control}
                name="logoType"
                render={({ field }) => (
                    <FormItem className="space-y-3">
                        <FormLabel>Logo Type</FormLabel>
                        <FormControl>
                            <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            value={field.value} // Control the value
                            className="flex space-x-4"
                            disabled={isSubmitting}
                            >
                            <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                <RadioGroupItem value="url" />
                                </FormControl>
                                <FormLabel className="font-normal">Use Logo URL</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                <RadioGroupItem value="custom" />
                                </FormControl>
                                <FormLabel className="font-normal">Use Custom Avatar</FormLabel>
                            </FormItem>
                            </RadioGroup>
                        </FormControl>
                         <FormMessage />
                    </FormItem>
                )}
            />


            {/* Conditional Logo URL Input */}
            {watchLogoType === 'url' && (
                <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Logo URL</FormLabel>
                        <FormControl>
                            <Input type="url" placeholder="https://example.com/logo.png" {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
            )}

            {/* Conditional Custom Avatar Inputs */}
             {watchLogoType === 'custom' && (
                <div className="space-y-4 rounded-md border p-4 mt-2">
                    <p className="text-sm font-medium text-muted-foreground">
                        Custom Avatar Options
                    </p>
                    <FormField
                        control={form.control}
                        name="logoInitials"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Initials (Optional)</FormLabel>
                                <FormDescription>Max 2 chars. Uses pod name if blank.</FormDescription>
                                <FormControl>
                                    <Input placeholder="AP" {...field} disabled={isSubmitting} maxLength={2} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                    <FormField
                        control={form.control}
                        name="logoBgColor"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Background Color (Optional)</FormLabel>
                                <FormDescription>Uses a random color if blank.</FormDescription>
                                <div className="flex items-center gap-2">
                                    <FormControl>
                                        <Input
                                            type="text"
                                            placeholder="#008080"
                                            {...field}
                                            disabled={isSubmitting}
                                            maxLength={7}
                                            className="w-32"
                                        />
                                    </FormControl>
                                    <Input
                                        type="color"
                                        value={field.value || '#008080'}
                                        onChange={(e) => field.onChange(e.target.value)}
                                        className="h-10 w-10 p-1 cursor-pointer"
                                        disabled={isSubmitting}
                                        title="Select background color"
                                    />
                                    <div
                                        className="h-10 w-10 rounded-md border"
                                        style={{ backgroundColor: field.value || 'transparent' }}
                                        title="Color Preview"
                                    />
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                </div>
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
        </form>
    </ScrollArea>

    {/* Footer outside the scroll area */}
    <DialogFooter className="mt-4 pt-4 border-t">
        <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancel
            </Button>
        </DialogClose>
        {/* Manually trigger form submission from footer button */}
        <Button type="button" onClick={form.handleSubmit(handleFormSubmit)} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? 'Saving...' : 'Save Pod'}
        </Button>
    </DialogFooter>
    </Form>
  );
}
