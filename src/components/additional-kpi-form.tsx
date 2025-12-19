
'use client';

import React, { useState } from 'react';
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
  FormDescription,
} from '@/components/ui/form';
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Loader2 } from 'lucide-react';
import type { AdditionalKpi, AdditionalKpiType, KpiSortOrder } from '@/app/(admin)/admin/additional-kpis/page';


const kpiFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  emoji: z.string().min(1, 'Emoji is required.'),
  type: z.enum(['number', 'percentage', 'scoreOutOf'], { required_error: "Please select a type."}),
  maxValue: z.coerce.number().optional(),
  sortOrder: z.enum(['desc', 'asc']).optional(), // 'desc' = higher is better, 'asc' = lower is better
}).superRefine((data, ctx) => {
    if (data.type === 'scoreOutOf' && (data.maxValue === undefined || data.maxValue <= 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Max value is required and must be greater than 0 for 'Score Out Of' type.",
            path: ['maxValue'],
        });
    }
    if (data.type === 'percentage' && !data.sortOrder) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Sort order is required for 'Percentage' type.",
            path: ['sortOrder'],
        });
    }
});

export type AdditionalKpiFormData = z.infer<typeof kpiFormSchema>;

interface AdditionalKpiFormProps {
  onSubmit: (data: AdditionalKpiFormData) => Promise<void> | void;
  onCancel: () => void;
  initialData?: AdditionalKpi | null;
}

export function AdditionalKpiForm({ onSubmit, onCancel, initialData }: AdditionalKpiFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<AdditionalKpiFormData>({
    resolver: zodResolver(kpiFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      emoji: initialData?.emoji || '',
      type: initialData?.type || 'number',
      maxValue: initialData?.maxValue || undefined,
      sortOrder: initialData?.sortOrder || 'desc',
    },
    mode: 'onChange',
  });

  const watchType = form.watch('type');

  const handleFormSubmit = async (data: AdditionalKpiFormData) => {
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
              <FormLabel>KPI Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Call Scoring" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="emoji"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Emoji</FormLabel>
              <FormControl>
                <Input placeholder="e.g., 📞" {...field} disabled={isSubmitting} maxLength={2} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Scoring Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={isSubmitting}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a scoring type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="number">Number (e.g., total calls)</SelectItem>
                  <SelectItem value="percentage">Percentage (e.g., 95%)</SelectItem>
                  <SelectItem value="scoreOutOf">Score Out Of (e.g., 4/5)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {(watchType === 'percentage' || watchType === 'scoreOutOf') && (
           <FormField
            control={form.control}
            name="sortOrder"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Goal</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={isSubmitting}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Goal Direction" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="desc">Higher is better</SelectItem>
                            <SelectItem value="asc">Lower is better</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormDescription>Define if a higher or lower score is the desired outcome.</FormDescription>
                    <FormMessage />
                </FormItem>
            )}
            />
        )}

        {watchType === 'scoreOutOf' && (
          <FormField
            control={form.control}
            name="maxValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Value</FormLabel>
                <FormControl>
                  <Input type="number" min="1" placeholder="e.g., 5" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
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
