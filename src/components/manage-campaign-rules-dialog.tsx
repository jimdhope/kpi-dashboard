
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
  deleteField,
  writeBatch,
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
import { Trash2, PlusCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Campaign } from '@/app/(admin)/admin/campaigns/page';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

// Define the structure of a single rule
const ruleSchema = z.object({
  id: z.string().optional(), // Optional ID for existing rules
  name: z.string().min(1, { message: 'Rule name is required.' }).max(50, { message: 'Name max 50 chars.' }),
  emoji: z.string().optional(), // Optional emoji
  points: z.coerce.number().int().min(0, { message: 'Points must be 0 or more.' }), // Ensure points are non-negative integers
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

const campaignRulesCollectionRef = collection(db, 'campaignRules'); // Collection to store rules

export function ManageCampaignRulesDialog({ campaign, onClose }: ManageCampaignRulesDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<CampaignRulesFormData>({
    resolver: zodResolver(campaignRulesFormSchema),
    defaultValues: {
      rules: [], // Start with an empty array
    },
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'rules',
  });

  // Fetch existing rules for the campaign
  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const rulesDocRef = doc(campaignRulesCollectionRef, campaign.id);
      const rulesDocSnap = await getDoc(rulesDocRef);

      if (rulesDocSnap.exists()) {
        const data = rulesDocSnap.data();
        const existingRules = data?.rules || [];
         // Ensure IDs are present for existing rules
         const rulesWithIds = existingRules.map((rule: any, index: number) => ({
            ...rule,
            id: rule.id || `temp-${index}` // Assign temporary ID if missing
         }));
        form.reset({ rules: rulesWithIds });
      } else {
        form.reset({ rules: [] }); // No existing rules found
      }
    } catch (error) {
      console.error("Error fetching campaign rules:", error);
      toast({
        variant: "destructive",
        title: "Error Loading Rules",
        description: "Could not load the rules for this campaign.",
      });
      form.reset({ rules: [] }); // Reset on error
    } finally {
      setIsLoading(false);
    }
  }, [campaign.id, form, toast]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Function to add a new empty rule field
  const addRule = () => {
    append({ id: `new-${Date.now()}`, name: '', emoji: '', points: 0 });
  };

  // Handle form submission
  const onSubmit = async (data: CampaignRulesFormData) => {
    setIsSaving(true);
    try {
      const rulesDocRef = doc(campaignRulesCollectionRef, campaign.id);

      // Prepare rules data, ensuring IDs are consistent or generated if new
       const rulesToSave = data.rules.map(rule => ({
        id: rule.id?.startsWith('new-') ? doc(campaignRulesCollectionRef).id : rule.id || doc(campaignRulesCollectionRef).id, // Generate ID if new
        name: rule.name,
        emoji: rule.emoji || '', // Ensure emoji is empty string if not provided
        points: rule.points,
      }));

      await setDoc(rulesDocRef, { rules: rulesToSave }, { merge: true }); // Use setDoc with merge to overwrite or create

      toast({
        title: "Rules Updated",
        description: `Rules for campaign "${campaign.name}" have been saved.`,
      });
      onClose(); // Close the dialog on success
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
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Manage Rules for {campaign.name}</DialogTitle>
        <DialogDescription>
          Define the default rules, emojis, and points for this campaign. These can be overridden at the pod level.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <ScrollArea className="max-h-[50vh] p-1 pr-4 mb-4">
            {isLoading ? (
               <div className="space-y-4 p-4">
                   {Array.from({ length: 3 }).map((_, index) => (
                       <div key={index} className="flex items-center gap-2 border p-3 rounded-md">
                           <Skeleton className="h-8 w-8" />
                           <Skeleton className="h-8 flex-1" />
                           <Skeleton className="h-8 w-16" />
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
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-end gap-2 border p-3 rounded-md bg-card">
                    <FormField
                      control={form.control}
                      name={`rules.${index}.emoji`}
                      render={({ field }) => (
                        <FormItem className="w-16">
                          <FormLabel className="sr-only">Emoji</FormLabel>
                          <FormControl>
                            <Input placeholder="🏆" {...field} maxLength={4} disabled={isSaving} className="text-center" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`rules.${index}.name`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="sr-only">Rule Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Rule Name" {...field} disabled={isSaving} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`rules.${index}.points`}
                      render={({ field }) => (
                        <FormItem className="w-24">
                          <FormLabel className="sr-only">Points</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Points" {...field} min="0" step="1" disabled={isSaving} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => remove(index)}
                      disabled={isSaving}
                      aria-label="Remove rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-start mb-6 px-4">
            <Button type="button" variant="outline" onClick={addRule} disabled={isSaving}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Rule
            </Button>
          </div>

          <DialogFooter className="mt-auto pt-4 border-t">
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSaving || isLoading}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSaving ? 'Saving...' : 'Save Rules'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
