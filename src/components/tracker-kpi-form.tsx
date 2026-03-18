
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Loader2 } from 'lucide-react';
import type { TrackerKpi } from '@/app/(admin)/admin/trackers/setup/page';


const kpiFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  initials: z.string().min(1, 'Initials are required.').max(4, 'Initials cannot be more than 4 characters.'),
});

export type TrackerKpiFormData = z.infer<typeof kpiFormSchema>;

interface TrackerKpiFormProps {
  onSubmit: (data: TrackerKpiFormData) => Promise<void> | void;
  onCancel: () => void;
  initialData?: TrackerKpi | null;
}

export function TrackerKpiForm({ onSubmit, onCancel, initialData }: TrackerKpiFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<TrackerKpiFormData>({
    resolver: zodResolver(kpiFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      initials: initialData?.initials || '',
    },
    mode: 'onChange',
  });

  const handleFormSubmit = async (data: TrackerKpiFormData) => {
    setIsSubmitting(true);
    await onSubmit(data);
    setIsSubmitting(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="grid gap-4 py-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tracker Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Smart Meter Appointments" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="initials"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Initials</FormLabel>
              <FormControl>
                <Input placeholder="e.g., SMA" {...field} disabled={isSubmitting} maxLength={4} />
              </FormControl>
              <FormDescription>A short code for table headers (1-4 chars).</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <DialogFooter className="mt-4 pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save KPI
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
