
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import type { Campaign } from '@/app/(admin)/admin/campaigns/page';
import { Loader2 } from 'lucide-react';

// Define the validation schema using Zod
const campaignFormSchema = z.object({
  name: z.string().min(3, { message: 'Campaign name must be at least 3 characters.' }).max(50, { message: 'Campaign name must be 50 characters or less.' }),
  logoType: z.enum(['url', 'custom'], { required_error: "Please select a logo type."}), // Radio button value
  logoUrl: z.string().optional().or(z.literal('')), // Optional URL
  logoInitials: z.string().max(2, { message: "Initials can be max 2 characters."}).optional(), // Optional custom initials
  logoBgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, { message: "Color must be a valid hex code (e.g., #RRGGBB)"}).optional().or(z.literal('')), // Optional hex color
}).superRefine((data, ctx) => {
    // Require logoUrl if logoType is 'url'
    if (data.logoType === 'url' && !data.logoUrl) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Logo URL is required when "Use Logo URL" is selected.',
            path: ['logoUrl'],
         });
    }
    // No specific validation needed for 'custom' as fields are optional with defaults
});


// Type for form data based on the schema
export type CampaignFormData = z.infer<typeof campaignFormSchema>;


interface CampaignFormProps {
  onSubmit: (data: CampaignFormData) => Promise<void> | void;
  onCancel: () => void;
  initialData?: Campaign; // Optional initial data for editing
}

export function CampaignForm({ onSubmit, onCancel, initialData }: CampaignFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Determine initial logo type based on existing data
    const getInitialLogoType = (): 'url' | 'custom' => {
        if (initialData?.logoUrl) {
            return 'url';
        }
        return 'custom'; // Default to custom if no URL
    };

    const form = useForm<CampaignFormData>({
        resolver: zodResolver(campaignFormSchema),
        defaultValues: {
            name: initialData?.name || '',
            logoType: getInitialLogoType(),
            logoUrl: initialData?.logoUrl || '',
            logoInitials: initialData?.logoInitials || '',
            logoBgColor: initialData?.logoBgColor || '',
        },
         mode: 'onChange', // Validate on change
    });

    const watchLogoType = form.watch('logoType');

    // Reset form if initialData changes (e.g., switching between edit targets)
    useEffect(() => {
         const initialType = getInitialLogoType();
        if (initialData) {
            form.reset({
                name: initialData.name,
                logoType: initialType,
                logoUrl: initialData.logoUrl || '',
                logoInitials: initialData.logoInitials || '',
                logoBgColor: initialData.logoBgColor || '',
            });
        } else {
            form.reset({
                name: '',
                logoType: 'custom', // Default to custom for new campaigns
                logoUrl: '',
                logoInitials: '',
                logoBgColor: '',
            });
        }
    }, [initialData, form]);

    const handleSubmit = async (data: CampaignFormData) => {
        setIsSubmitting(true);
        try {
             // Clear the unused logo fields based on selection before submitting
             const submitData = {
                ...data,
                logoUrl: data.logoType === 'url' ? data.logoUrl || '' : '',
                logoInitials: data.logoType === 'custom' ? data.logoInitials || '' : '',
                logoBgColor: data.logoType === 'custom' ? data.logoBgColor || '' : '',
             };
             await onSubmit(submitData);
             // Let parent handle success (closing dialog, toast)
        } catch (error) {
            console.error("Error in CampaignForm onSubmit:", error);
             // Error handled by parent onSubmit
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <Form {...form}>
        {/* Use ScrollArea to make the form content scrollable */}
         <ScrollArea className="h-[60vh] pr-6"> {/* Adjust max height as needed */}
            <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4 py-4 pl-2 pr-1">
                <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Campaign Name</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Q4 Sales Push" {...field} disabled={isSubmitting} />
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
                           value={field.value} // Ensure value is controlled
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
                            <Input type="url" placeholder="https://example.com/logo.png" {...field} disabled={isSubmitting}/>
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
                                    <FormDescription>Max 2 chars. Uses campaign name if blank.</FormDescription>
                                    <FormControl>
                                        <Input placeholder="Q4" {...field} disabled={isSubmitting} maxLength={2} />
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
                                                placeholder="#FFD700"
                                                {...field}
                                                disabled={isSubmitting}
                                                maxLength={7}
                                                className="w-32"
                                            />
                                        </FormControl>
                                        <Input
                                            type="color"
                                            value={field.value || '#FFD700'}
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

            </form>
        </ScrollArea>
            {/* Footer remains outside the scroll area */}
            <DialogFooter className="mt-4 pt-4 border-t">
                <DialogClose asChild>
                    <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                        Cancel
                    </Button>
                </DialogClose>
                {/* Manually trigger form submission from footer button */}
                <Button type="button" onClick={form.handleSubmit(handleSubmit)} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSubmitting ? 'Saving...' : 'Save Campaign'}
                </Button>
            </DialogFooter>
        </Form>
    );
}
