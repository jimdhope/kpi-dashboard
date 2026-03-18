
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  collection,
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Trash2, PlusCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Campaign } from '@/app/(admin)/admin/campaigns/page';
import { Skeleton } from '@/components/ui/skeleton';

// Define the structure of a single rule, now with a 'type'
const ruleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: 'Rule name is required.' }).max(50, { message: 'Name max 50 chars.' }),
  emoji: z.string().optional(),
  points: z.coerce.number().int().min(0, { message: 'Points must be 0 or more.' }),
  type: z.enum(['numeric', 'checkbox'], { required_error: 'Please select a rule type.' }), // Added type
});

// Define the schema for the entire form (an array of rules)
const campaignRulesFormSchema = z.object({
  rules: z.array(ruleSchema),
});

export type RuleFormData = z.infer<typeof ruleSchema>;
export type CampaignRulesFormData = z.infer<typeof campaignRulesFormSchema>;

interface ManageCampaignRulesDialogProps {
  campaign: Campaign;
  onClose: () => void;
}

const campaignRulesCollectionRef = collection(db, 'campaignRules');

export function ManageCampaignRulesDialog({ campaign, onClose }: ManageCampaignRulesDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<CampaignRulesFormData>({
    resolver: zodResolver(campaignRulesFormSchema),
    defaultValues: {
      rules: [],
    },
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'rules',
  });

  const watchedRules = form.watch('rules');

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const rulesDocRef = doc(campaignRulesCollectionRef, campaign.id);
      const rulesDocSnap = await getDoc(rulesDocRef);

      if (rulesDocSnap.exists()) {
        const data = rulesDocSnap.data();
        const existingRules = data?.rules || [];
        const rulesWithDefaults = existingRules.map((rule: any, index: number) => ({
            ...rule,
            id: rule.id || `temp-${index}`,
            type: rule.type || 'numeric', // Default to numeric if type is missing
        }));
        form.reset({ rules: rulesWithDefaults });
      } else {
        form.reset({ rules: [] });
      }
    } catch (error) {
      console.error("Error fetching campaign rules:", error);
      toast({
        variant: "destructive",
        title: "Error Loading Rules",
        description: "Could not load the rules for this campaign.",
      });
      form.reset({ rules: [] });
    } finally {
      setIsLoading(false);
    }
  }, [campaign.id, form, toast]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const addRule = () => {
    append({ id: `new-${Date.now()}`, name: '', emoji: '', points: 0, type: 'numeric' });
  };

  const onSubmit = async (data: CampaignRulesFormData) => {
    setIsSaving(true);
    try {
      const rulesDocRef = doc(campaignRulesCollectionRef, campaign.id);
      const rulesToSave = data.rules.map(rule => ({
        id: rule.id?.startsWith('new-') ? doc(campaignRulesCollectionRef).id : rule.id || doc(campaignRulesCollectionRef).id,
        name: rule.name,
        emoji: rule.emoji || '',
        points: rule.type === 'checkbox' ? 0 : rule.points, // Force points to 0 for checkbox type
        type: rule.type,
      }));

      await setDoc(rulesDocRef, { rules: rulesToSave }, { merge: true });
      toast({
        title: "Rules Updated",
        description: `Rules for campaign "${campaign.name}" have been saved.`,
      });
      onClose();
    } catch (error) {
      console.error("Error saving campaign rules:", error);
      toast({
        variant: "destructive",
        title: "Error Saving Rules",
        description: "Could not save the rules for this campaign.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-2xl"> {/* Increased width */}
      <DialogHeader>
        <DialogTitle>Manage Rules for {campaign.name}</DialogTitle>
        <DialogDescription>
          Define the default rules, emojis, points, and types for this campaign.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
           <ScrollArea className="max-h-[50vh] p-1 pr-4 mb-4">
            {isLoading ? (
               <div className="space-y-4 p-4">
                   {Array.from({ length: 3 }).map((_, index) => (
                       <div key={index} className="flex items-center gap-2 border p-3 rounded-md">
                           <Skeleton className="h-8 w-12" />
                           <Skeleton className="h-8 flex-1" />
                           <Skeleton className="h-8 w-16" />
                           <Skeleton className="h-8 w-24" />
                           <Skeleton className="h-8 w-8" />
                       </div>
                   ))}
               </div>
            ) : fields.length === 0 ? (
               <div className="text-center text-muted-foreground py-6">
                  No rules defined yet. Click "Add Rule" to start.
               </div>
            ) : (
              <div className="space-y-4 p-4">
                 <div className="flex items-end gap-2 px-3 pb-1 text-xs font-medium text-muted-foreground">
                    <Label className="w-12 text-left">Emoji</Label>
                    <Label className="flex-1 text-left">Rule Name</Label>
                    <Label className="w-24 text-left">Type</Label>
                    <Label className="w-20 text-left">Points</Label>
                    <div className="w-8" />
                 </div>
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-2 border p-3 rounded-md bg-card">
                    <FormField control={form.control} name={`rules.${index}.emoji`} render={({ field }) => (<FormItem className="w-12"><FormLabel className="sr-only">Emoji</FormLabel><FormControl><Input placeholder={field.value ? "" : "❓"} {...field} maxLength={4} disabled={isSaving} className="text-center" /></FormControl><FormMessage className="text-xs" /></FormItem>)} />
                    <FormField control={form.control} name={`rules.${index}.name`} render={({ field }) => (<FormItem className="flex-1"><FormLabel className="sr-only">Rule Name</FormLabel><FormControl><Input placeholder="Rule Name" {...field} disabled={isSaving} /></FormControl><FormMessage className="text-xs" /></FormItem>)} />
                    <FormField control={form.control} name={`rules.${index}.type`} render={({ field }) => (
                        <FormItem className="w-24">
                          <FormLabel className="sr-only">Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSaving}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="numeric">Numeric</SelectItem><SelectItem value="checkbox">Checkbox</SelectItem></SelectContent>
                          </Select>
                          <FormMessage className="text-xs" />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name={`rules.${index}.points`} render={({ field }) => (
                        <FormItem className="w-20">
                          <FormLabel className="sr-only">Points</FormLabel>
                          <FormControl><Input type="number" placeholder="Pts" {...field} min="0" step="1" disabled={isSaving || (watchedRules && watchedRules[index]?.type === 'checkbox')} /></FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                    )} />
                     <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 mt-1" onClick={() => remove(index)} disabled={isSaving} aria-label="Remove rule"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
             <div className="flex justify-start mb-6 px-4">
                <Button type="button" variant="outline" onClick={addRule} disabled={isSaving}><PlusCircle className="mr-2 h-4 w-4" /> Add Rule</Button>
             </div>
          </ScrollArea>
          <DialogFooter className="mt-auto pt-4 border-t">
            <DialogClose asChild><Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSaving || isLoading}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{isSaving ? 'Saving...' : 'Save Rules'}</Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
