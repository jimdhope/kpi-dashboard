'use client';

import React, { useEffect } from 'react';
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
import { DialogFooter, DialogClose } from "@/components/ui/dialog"; // Import DialogFooter
import type { Campaign } from '@/app/(admin)/admin/campaigns/page'; // Import Campaign type

// Define the validation schema using Zod
const campaignFormSchema = z.object({
  name: z.string().min(3, { message: 'Campaign name must be at least 3 characters.' }).max(50, { message: 'Campaign name must be 50 characters or less.' }),
  // For now, logoUrl is just a string. In a real app, this would handle file uploads.
  logoUrl: z.string().url({ message: 'Please enter a valid URL for the logo.' }).or(z.literal('')), // Allow empty string or valid URL
});

// Type for form data based on the schema
export type CampaignFormData = z.infer<typeof campaignFormSchema>;

interface CampaignFormProps {
  onSubmit: (data: CampaignFormData) => void;
  onCancel: () => void;
  initialData?: Campaign; // Optional initial data for editing
}

export function CampaignForm({ onSubmit, onCancel, initialData }: CampaignFormProps) {
  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      logoUrl: initialData?.logoUrl || 'https://picsum.photos/seed/placeholder/40', // Default placeholder or initial
    },
  });

  // Reset form if initialData changes (e.g., switching between edit targets)
  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        logoUrl: initialData.logoUrl || 'https://picsum.photos/seed/placeholder/40',
      });
    } else {
        form.reset({
            name: '',
            logoUrl: 'https://picsum.photos/seed/newlogo/40', // Default for new
        });
    }
  }, [initialData, form]);

  const handleSubmit = (data: CampaignFormData) => {
    // If logoUrl is empty, use a default placeholder
    const finalData = {
      ...data,
      logoUrl: data.logoUrl || `https://picsum.photos/seed/${data.name.replace(/\s+/g, '-').toLowerCase()}/40`, // Generate placeholder if empty
    };
    onSubmit(finalData);
    form.reset(); // Reset form after successful submission
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
                <Input placeholder="e.g., Q4 Sales Push" {...field} />
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
                <Input
                  placeholder="https://example.com/logo.png (optional)"
                   {...field}
                   />
              </FormControl>
               <FormMessage className="col-span-3 col-start-2" />
            </FormItem>
          )}
        />
         {/* TODO: Add actual file upload component here instead of URL input */}
         {/* <FormItem className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Upload Logo</Label>
              <Input type="file" className="col-span-3" disabled />
              <p className="col-span-3 col-start-2 text-xs text-muted-foreground">File upload not implemented yet.</p>
          </FormItem> */}

          <DialogFooter>
             <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : 'Save Campaign'}
              </Button>
          </DialogFooter>
      </form>
    </Form>
  );
}
