
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import type { AdditionalKpi, PassFailOperator } from '@/app/(admin)/admin/additional-kpis/page';


const kpiFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  initials: z.string().min(1, 'Initials are required.').max(4, 'Initials cannot be more than 4 characters.'), // Changed from emoji
  type: z.enum(['number', 'percentage', 'scoreOutOf'], { required_error: "Please select a type."}),
  maxValue: z.coerce.number().optional(),
  sortOrder: z.enum(['desc', 'asc']).optional(),
  passFailCriteriaEnabled: z.boolean().optional(),
  passFailOperator: z.enum(['gte', 'lte']).optional(),
  passFailValue: z.coerce.number().optional(),
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
            message: "Goal direction is required for 'Percentage' type.",
            path: ['sortOrder'],
        });
    }
    if (data.passFailCriteriaEnabled) {
        if (!data.passFailOperator) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Operator is required.", path: ['passFailOperator'] });
        }
        if (data.passFailValue === undefined || data.passFailValue === null) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Target value is required.", path: ['passFailValue'] });
        }
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
      initials: initialData?.initials || '', // Changed from emoji
      type: initialData?.type || 'number',
      maxValue: initialData?.maxValue,
      sortOrder: initialData?.sortOrder || 'desc',
      passFailCriteriaEnabled: initialData?.passFailCriteriaEnabled || false,
      passFailOperator: initialData?.passFailOperator || 'gte',
      passFailValue: initialData?.passFailValue,
    },
    mode: 'onChange',
  });

  const watchType = form.watch('type');
  const watchPassFailEnabled = form.watch('passFailCriteriaEnabled');

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
          name="initials"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Initials</FormLabel>
              <FormControl>
                <Input placeholder="e.g., CS" {...field} disabled={isSubmitting} maxLength={4} />
              </FormControl>
              <FormDescription>A short code for table headers (1-4 chars).</FormDescription>
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

        <div className="space-y-4 rounded-md border p-4">
            <FormField
                control={form.control}
                name="passFailCriteriaEnabled"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                            <FormLabel>Pass/Fail Criteria</FormLabel>
                            <FormDescription>Set a threshold for pass/fail reporting.</FormDescription>
                        </div>
                        <FormControl>
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={isSubmitting}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
            {watchPassFailEnabled && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                    <FormField
                        control={form.control}
                        name="passFailOperator"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Condition</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Operator" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="gte">Greater than or equal to (&gt;=)</SelectItem>
                                        <SelectItem value="lte">Less than or equal to (&lt;=)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="passFailValue"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Target Value</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="e.g., 95" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} disabled={isSubmitting} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            )}
        </div>


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
