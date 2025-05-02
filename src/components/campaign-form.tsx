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
} from '@/components/ui/form';
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import type { Campaign } from '@/app/(admin)/admin/campaigns/page';
import { Loader2 } from 'lucide-react'; // Import Loader

// Define the validation schema using Zod
const campaignFormSchema = z.object({
  name: z.string().min(3, { message: 'Campaign name must be at least 3 characters.' }).max(50, { message: 'Campaign name must be 50 characters or less.' }),
  logoUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')), // Optional URL
});

// Type for form data based on the schema
export type CampaignFormData = z.infer<typeof campaignFormSchema>;


interface CampaignFormProps {
  onSubmit: (data: CampaignFormData) => Promise<void> | void; // No file needed
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
        },
    });


    // Reset form if initialData changes (e.g., switching between edit targets)
    useEffect(() => {
        if (initialData) {
        form.reset({
            name: initialData.name,
            logoUrl: initialData.logoUrl,
        });
        } else {
            form.reset({
                name: '',
                logoUrl: '',
            });
        }
    }, [initialData, form]);

    const handleSubmit = async (data: CampaignFormData) => {
        setIsSubmitting(true);
        try {
             // Ensure logoUrl is empty string if undefined or null, but allow actual URL
             const submitData = {
                ...data,
                logoUrl: data.logoUrl || '',
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
                    <FormMessage className="col-span-3 col-start-2" />
                    </FormItem>
                )}
                />


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
