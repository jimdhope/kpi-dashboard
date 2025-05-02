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
import Image from 'next/image'; // Import Image for preview
import { Loader2 } from 'lucide-react'; // Import Loader

// Define the maximum file size (e.g., 2MB)
const MAX_FILE_SIZE = 2 * 1024 * 1024;
// Define accepted image types
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

// Define the validation schema using Zod
const campaignFormSchema = z.object({
  name: z.string().min(3, { message: 'Campaign name must be at least 3 characters.' }).max(50, { message: 'Campaign name must be 50 characters or less.' }),
  logoFile: z
    .custom<FileList>()
    .optional()
    .refine((files) => !files || files.length === 0 || files[0]?.size <= MAX_FILE_SIZE, `Max file size is 2MB.`)
    .refine(
      (files) => !files || files.length === 0 || ACCEPTED_IMAGE_TYPES.includes(files[0]?.type),
      "Only .jpg, .jpeg, .png, .webp and .gif formats are supported."
    ),
  // Keep logoUrl for display/initial data, but don't make it a form field
  logoUrl: z.string().optional(),
});


// Type for form data based on the schema
// Explicitly include logoFile which might be FileList | undefined
export type CampaignFormData = Omit<z.infer<typeof campaignFormSchema>, 'logoFile'> & {
  logoFile?: File | null; // Handle single file
  logoUrl?: string; // logoUrl still exists for initial data and result
};


interface CampaignFormProps {
  onSubmit: (data: CampaignFormData, file?: File) => Promise<void> | void; // Pass file separately
  onCancel: () => void;
  initialData?: Campaign; // Optional initial data for editing
}

export function CampaignForm({ onSubmit, onCancel, initialData }: CampaignFormProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(initialData?.logoUrl || null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof campaignFormSchema>>({ // Use schema type here
        resolver: zodResolver(campaignFormSchema),
        defaultValues: {
        name: initialData?.name || '',
        logoUrl: initialData?.logoUrl || '', // Keep for initial display
        logoFile: undefined, // FileList is not directly settable here
        },
    });

    // Watch the file input
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
            // If no file is selected and no initial URL, clear preview
            setPreviewUrl(null);
        } else {
            // Otherwise, keep the initial URL preview
            setPreviewUrl(initialData.logoUrl);
        }
    }, [logoFileWatch, initialData?.logoUrl]);


    // Reset form if initialData changes (e.g., switching between edit targets)
    useEffect(() => {
        if (initialData) {
        form.reset({
            name: initialData.name,
            logoUrl: initialData.logoUrl,
            logoFile: undefined, // Reset file input
        });
         setPreviewUrl(initialData.logoUrl || null); // Reset preview
        } else {
            form.reset({
                name: '',
                logoUrl: '',
                logoFile: undefined,
            });
             setPreviewUrl(null); // Clear preview for new campaign
        }
    }, [initialData, form]);

    const handleSubmit = async (data: z.infer<typeof campaignFormSchema>) => {
        setIsSubmitting(true);
        const file = data.logoFile?.[0] ?? null; // Get the single file or null

        // Prepare data to submit, excluding the FileList
        const submitData: CampaignFormData = {
            name: data.name,
            // logoUrl might be updated by the onSubmit handler after upload
            logoUrl: initialData?.logoUrl, // Pass existing URL if editing and no new file
        };

        try {
             await onSubmit(submitData, file || undefined); // Pass file separately
             // Let parent handle success (closing dialog, toast)
             // form.reset(); // Reset form after successful submission - Handled by parent potentially
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
            name="logoFile"
            render={({ field: { onChange, value, ...rest } }) => ( // Destructure field carefully
                <FormItem className="grid grid-cols-4 items-center gap-4">
                <FormLabel className="text-right">Logo</FormLabel>
                <FormControl className="col-span-3">
                     <Input
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES.join(',')}
                        disabled={isSubmitting}
                        {...rest} // Spread the rest of the field props
                         onChange={(e) => {
                            onChange(e.target.files); // Update form state with FileList
                        }}
                     />
                </FormControl>
                <FormMessage className="col-span-3 col-start-2" />
                </FormItem>
            )}
            />

             {/* Logo Preview */}
             {previewUrl && (
                 <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right">Preview</FormLabel>
                    <div className="col-span-3">
                        <Image
                        src={previewUrl}
                        alt="Logo preview"
                        width={64} // Adjust size as needed
                        height={64}
                        className="rounded-md border"
                        data-ai-hint="logo preview"
                        />
                    </div>
                 </FormItem>
             )}


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
