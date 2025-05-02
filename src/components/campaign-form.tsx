'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Loader2, Palette } from 'lucide-react'; // Import Loader and Palette icon

// Define the validation schema using Zod
const campaignFormSchema = z.object({
  name: z.string().min(3, { message: 'Campaign name must be at least 3 characters.' }).max(50, { message: 'Campaign name must be 50 characters or less.' }),
  logoUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')), // Optional URL
  logoInitials: z.string().max(2, { message: "Initials can be max 2 characters."}).optional(), // Optional custom initials
  logoBgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, { message: "Color must be a valid hex code (e.g., #RRGGBB)"}).optional().or(z.literal('')), // Optional hex color
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

    const form = useForm<CampaignFormData>({
        resolver: zodResolver(campaignFormSchema),
        defaultValues: {
            name: initialData?.name || '',
            logoUrl: initialData?.logoUrl || '', // Use initial URL
            logoInitials: initialData?.logoInitials || '', // Use initial initials
            logoBgColor: initialData?.logoBgColor || '', // Use initial color
        },
    });

    // Watch logoUrl to disable custom options
    const watchLogoUrl = form.watch('logoUrl');


    // Reset form if initialData changes (e.g., switching between edit targets)
    useEffect(() => {
        if (initialData) {
            form.reset({
                name: initialData.name,
                logoUrl: initialData.logoUrl || '',
                logoInitials: initialData.logoInitials || '',
                logoBgColor: initialData.logoBgColor || '',
            });
        } else {
            form.reset({
                name: '',
                logoUrl: '',
                logoInitials: '',
                logoBgColor: '',
            });
        }
    }, [initialData, form]);

    const handleSubmit = async (data: CampaignFormData) => {
        setIsSubmitting(true);
        try {
             // Ensure optional fields are empty strings if falsy
             const submitData = {
                ...data,
                logoUrl: data.logoUrl || '',
                logoInitials: data.logoInitials || '',
                logoBgColor: data.logoBgColor || '',
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

    const isCustomLogoDisabled = !!watchLogoUrl; // Disable custom options if URL is present


    return (
        <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4 py-4">
            <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                <FormLabel className="text-right">Name</FormLabel>
                <FormControl className="col-span-3">
                    <Input placeholder="e.g., Q4 Sales Push" {...field} disabled={isSubmitting} />
                </FormControl>
                <FormMessage className="col-span-3 col-start-2" />
                </FormItem>
            )}
            />

             <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right">Logo URL</FormLabel>
                    <FormControl className="col-span-3">
                        <Input type="url" placeholder="https://example.com/logo.png (Optional)" {...field} disabled={isSubmitting}/>
                    </FormControl>
                     <FormDescription className="col-span-3 col-start-2 text-xs">Overrides custom avatar below.</FormDescription>
                    <FormMessage className="col-span-3 col-start-2" />
                    </FormItem>
                )}
                />

             {/* Custom Logo Options - Only enabled if logoUrl is empty */}
             <div className={`grid grid-cols-4 items-start gap-4 ${isCustomLogoDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                 <Label className="text-right pt-2">Custom Avatar</Label>
                 <div className="col-span-3 space-y-4 rounded-md border p-4">
                    <FormField
                        control={form.control}
                        name="logoInitials"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Initials</FormLabel>
                                <FormDescription>Max 2 characters. Uses campaign name if blank.</FormDescription>
                                <FormControl>
                                    <Input placeholder="e.g., Q4" {...field} disabled={isSubmitting || isCustomLogoDisabled} maxLength={2} />
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
                                <FormLabel>Background Color</FormLabel>
                                <FormDescription>Uses a random color if blank.</FormDescription>
                                <div className="flex items-center gap-2">
                                    <FormControl>
                                        <Input
                                            type="text" // Keep text input for hex code
                                            placeholder="#FFD700"
                                            {...field}
                                            disabled={isSubmitting || isCustomLogoDisabled}
                                            maxLength={7}
                                            className="w-32"
                                        />
                                    </FormControl>
                                    {/* Simple Color Picker using HTML5 input type="color" */}
                                    <Input
                                        type="color"
                                        value={field.value || '#FFD700'} // Default value for picker
                                        onChange={(e) => field.onChange(e.target.value)}
                                        className="h-10 w-10 p-1 cursor-pointer" // Basic styling
                                        disabled={isSubmitting || isCustomLogoDisabled}
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
             </div>


            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                        Cancel
                    </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSubmitting ? 'Saving...' : 'Save Campaign'}
                </Button>
            </DialogFooter>
        </form>
        </Form>
    );
}
