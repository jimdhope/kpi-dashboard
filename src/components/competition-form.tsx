'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Timestamp, doc, getDoc } from 'firebase/firestore'; // Import Firestore specific types/functions
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"; // Ensure Popover imports are correct
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { CalendarIcon, Trash2, PlusCircle, Loader2, AlertCircle } from 'lucide-react'; // Ensure CalendarIcon is imported
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import type { Competition } from '@/app/(admin)/admin/competitions/page'; // Import Competition type
import type { Campaign } from '@/app/(admin)/admin/campaigns/page'; // Import Campaign type
import type { Pod } from '@/app/(admin)/admin/pods/page'; // Import Pod type
import { RuleFormData } from '@/components/manage-campaign-rules-dialog'; // Reuse Rule type definition

// --- Zod Schema Definition ---

// Reusable rule schema
const competitionRuleSchema = z.object({
  id: z.string(), // Keep ID for reference/key
  name: z.string().min(1, { message: 'Rule name is required.' }),
  emoji: z.string().optional(),
  points: z.coerce.number().int().min(0, { message: 'Points must be >= 0.' }),
  // Add target later if needed
});

// Main competition form schema
const competitionFormSchema = z.object({
  name: z.string().min(3, { message: 'Competition name required (min 3 chars).' }).max(50, { message: 'Name max 50 chars.' }),
  campaignId: z.string().min(1, { message: 'Please select a campaign.' }),
  podId: z.string().min(1, { message: 'Please select a pod.' }),
  startDate: z.date({ required_error: "Start date is required." }),
  endDate: z.date({ required_error: "End date is required." }),
  rules: z.array(competitionRuleSchema).min(1, { message: 'At least one rule is required.' }),
}).refine(data => data.endDate >= data.startDate, {
    message: "End date cannot be before start date.",
    path: ["endDate"], // Attach error to endDate field
});

// Type for form data based on the schema
export type CompetitionFormData = z.infer<typeof competitionFormSchema>;

// --- Component Props ---

interface CompetitionFormProps {
  onSubmit: (data: CompetitionFormData, rules: RuleFormData[]) => Promise<void> | void; // Pass rules separately
  onCancel: () => void;
  initialData?: Competition; // Optional initial data for editing
  campaigns: Campaign[];
  pods: Pod[];
  mode: 'add' | 'edit';
}

// --- Helper Functions ---

// Fetch default rules for a selected campaign
const fetchCampaignRules = async (campaignId: string): Promise<RuleFormData[]> => {
  if (!campaignId) return [];
  try {
    const rulesDocRef = doc(db, 'campaignRules', campaignId);
    const rulesDocSnap = await getDoc(rulesDocRef);
    if (rulesDocSnap.exists()) {
      return (rulesDocSnap.data()?.rules || []) as RuleFormData[];
    }
    return [];
  } catch (error) {
    console.error("Error fetching campaign rules:", error);
    return []; // Return empty on error
  }
};


// --- CompetitionForm Component ---

export function CompetitionForm({ onSubmit, onCancel, initialData, campaigns, pods, mode }: CompetitionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRules, setIsLoadingRules] = useState(false); // State for loading default rules
  const { toast } = useToast();

  const form = useForm<CompetitionFormData>({
    resolver: zodResolver(competitionFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      campaignId: initialData?.campaignId || '',
      podId: initialData?.podId || '',
      // Convert Timestamps back to Dates for the form
      startDate: initialData?.startDate?.toDate(),
      endDate: initialData?.endDate?.toDate(),
      rules: initialData?.rules || [],
    },
    mode: 'onChange',
  });

   // Field array for managing rules dynamically
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'rules',
    keyName: "fieldId", // Use fieldId to avoid conflicts with rule's own 'id'
  });

   // --- Effects ---

   // Reset form when initialData changes (for edit mode)
   useEffect(() => {
    if (initialData && mode === 'edit') {
      form.reset({
        name: initialData.name,
        campaignId: initialData.campaignId,
        podId: initialData.podId,
        startDate: initialData.startDate?.toDate(),
        endDate: initialData.endDate?.toDate(),
        rules: initialData.rules || [],
      });
    } else if (mode === 'add') {
        // Reset for add mode, clearing rules initially
        form.reset({
            name: '',
            campaignId: '',
            podId: '',
            startDate: undefined,
            endDate: undefined,
            rules: [], // Start with empty rules in add mode
        });
    }
  }, [initialData, mode, form]);


  // Watch campaignId to load default rules in 'add' mode
  const watchedCampaignId = form.watch('campaignId');

  useEffect(() => {
    if (mode === 'add' && watchedCampaignId) {
       const loadRules = async () => {
           setIsLoadingRules(true);
            try {
                const defaultRules = await fetchCampaignRules(watchedCampaignId);
                 // Use replace to set the fetched rules, generating new field IDs
                 replace(defaultRules.map(rule => ({ ...rule, id: rule.id || `new-${Date.now()}-${Math.random()}` }))); // Ensure IDs exist
                 form.trigger("rules"); // Trigger validation after replacing rules
            } catch (e) {
                 toast({ variant: "destructive", title: "Error", description: "Could not load default campaign rules." });
                 replace([]); // Clear rules on error
            } finally {
                setIsLoadingRules(false);
            }
       };
       loadRules();
    } else if (mode === 'add' && !watchedCampaignId) {
        // Clear rules if campaign is deselected in add mode
        replace([]);
    }
     // Dependency: mode, watchedCampaignId, replace, toast, form.trigger
  }, [mode, watchedCampaignId, replace, toast, form]);


  // --- Event Handlers ---

  const handleAddRule = () => {
     // Add a new blank rule with a unique temporary ID
    append({ id: `new-${Date.now()}-${Math.random()}`, name: '', emoji: '', points: 0 });
  };

  const handleFormSubmit = async (data: CompetitionFormData) => {
    setIsSubmitting(true);
    try {
        // The data object already has Date objects from react-hook-form
        // Convert Dates to Timestamps before calling onSubmit
        const dataToSend = {
            ...data,
            startDate: Timestamp.fromDate(data.startDate),
            endDate: Timestamp.fromDate(data.endDate),
            // Rules are already in the correct format from the form state
        };
         // Pass the rules array separately as well
        await onSubmit(dataToSend as any, data.rules); // Pass data with Timestamps and the rules array
    } catch (error) {
        console.error("Error during competition form submission:", error);
         // Parent component's onSubmit should handle showing toast on error
    } finally {
        setIsSubmitting(false);
    }
  };

   // Filter pods based on selected campaign
   const filteredPods = pods.filter(pod => pod.campaignId === watchedCampaignId);

  return (
    <Form {...form}>
       {/* Wrap main form content in ScrollArea */}
      <ScrollArea className="h-[65vh] pr-6"> {/* Adjust height as needed */}
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="grid gap-6 py-4 pl-2 pr-1"> {/* Increased gap */}

          {/* Competition Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Competition Name</FormLabel>
                <FormControl><Input placeholder="e.g., Weekly Sprint - Q1 Week 5" {...field} disabled={isSubmitting} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Campaign Selection */}
          <FormField
            control={form.control}
            name="campaignId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Campaign</FormLabel>
                <Select
                    onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue('podId', ''); // Reset pod selection when campaign changes
                        // Rules will be updated by the useEffect hook watching campaignId
                    }}
                    value={field.value}
                    disabled={isSubmitting || mode === 'edit'} // Disable campaign change in edit mode
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a campaign" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                 {mode === 'edit' && <p className="text-xs text-muted-foreground mt-1">Campaign cannot be changed after creation.</p>}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Pod Selection (Filtered by Campaign) */}
          <FormField
            control={form.control}
            name="podId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pod</FormLabel>
                <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSubmitting || !watchedCampaignId || mode === 'edit'} // Disable if no campaign or editing
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={!watchedCampaignId ? "Select campaign first" : "Select a pod"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {!watchedCampaignId ? (
                      <SelectItem value="-" disabled>No campaign selected</SelectItem>
                    ) : filteredPods.length === 0 ? (
                      <SelectItem value="-" disabled>No pods in selected campaign</SelectItem>
                    ) : (
                      filteredPods.map((pod) => (
                        <SelectItem key={pod.id} value={pod.id}>
                          {pod.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                 {mode === 'edit' && <p className="text-xs text-muted-foreground mt-1">Pod cannot be changed after creation.</p>}
                <FormMessage />
              </FormItem>
            )}
          />

           {/* Start Date */}
           <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "w-[240px] pl-3 text-left font-normal justify-start", // Added justify-start
                                    !field.value && "text-muted-foreground"
                                    )}
                                    disabled={isSubmitting}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4 opacity-50" /> {/* Moved icon left */}
                                    {field.value ? (
                                    format(field.value, "PPP") // Format date nicely
                                    ) : (
                                    <span>Pick a date</span>
                                    )}
                                </Button>
                             </FormControl>
                        </PopoverTrigger>
                         <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange} // Changed to pass function directly
                                // Optional: Disable past dates relative to today
                                disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) || isSubmitting}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                </FormItem>
                )}
            />

            {/* End Date */}
            <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                             <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "w-[240px] pl-3 text-left font-normal justify-start", // Added justify-start
                                    !field.value && "text-muted-foreground"
                                    )}
                                    disabled={isSubmitting || !form.watch('startDate')} // Disable if no start date
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4 opacity-50" /> {/* Moved icon left */}
                                    {field.value ? (
                                    format(field.value, "PPP")
                                    ) : (
                                    <span>Pick a date</span>
                                    )}
                                </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange} // Changed to pass function directly
                                // Disable dates before start date
                                disabled={(date) =>
                                    (form.watch('startDate') && date < form.watch('startDate')!) ||
                                    isSubmitting
                                }
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                </FormItem>
                )}
            />

           {/* Rules Section */}
            <div className="space-y-4 rounded-md border p-4 mt-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Competition Rules</h3>
                     <Button type="button" variant="outline" size="sm" onClick={handleAddRule} disabled={isSubmitting || isLoadingRules}>
                       {isLoadingRules ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                       Add Rule
                     </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                   {mode === 'add' ? 'Default rules loaded from campaign. Modify or add rules specific to this competition.' : 'Modify the rules for this specific competition.'}
                </p>

                 {isLoadingRules && (
                     <div className="text-center p-4">
                         <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-muted-foreground" />
                         <p className="text-sm text-muted-foreground">Loading default rules...</p>
                     </div>
                 )}

                {!isLoadingRules && fields.length === 0 && (
                     <div className="text-center text-muted-foreground py-4 border-dashed border-2 rounded-md">
                         <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2"/>
                         <p>No rules defined.</p>
                         {mode === 'add' && !watchedCampaignId && <p>Select a campaign to load default rules.</p>}
                         {mode === 'add' && watchedCampaignId && <p>Add rules manually or check campaign settings.</p>}
                         {mode === 'edit' && <p>Add rules manually.</p>}
                     </div>
                 )}

                 {!isLoadingRules && fields.length > 0 && (
                    <div className="space-y-4">
                        {/* Header Row */}
                        <div className="flex items-end gap-2 px-3 pb-1 text-xs font-medium text-muted-foreground">
                            <Label className="w-12 text-left">Emoji</Label>
                            <Label className="flex-1 text-left">Rule Name</Label>
                            <Label className="w-20 text-left">Points</Label>
                            <div className="w-8" /> {/* Spacer */}
                        </div>
                        {/* Rule Rows */}
                        {fields.map((field, index) => (
                            <div key={field.fieldId} className="flex items-start gap-2 border p-3 rounded-md bg-card">
                                <FormField
                                    control={form.control}
                                    name={`rules.${index}.emoji`}
                                    render={({ field: ruleField }) => (
                                        <FormItem className="w-12">
                                         <FormLabel className="sr-only">Emoji</FormLabel> {/* Added Sr Label */}
                                        <FormControl><Input placeholder="🏆" {...ruleField} maxLength={4} disabled={isSubmitting} className="text-center h-9" /></FormControl>
                                        <FormMessage className="text-xs" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`rules.${index}.name`}
                                    render={({ field: ruleField }) => (
                                        <FormItem className="flex-1">
                                         <FormLabel className="sr-only">Rule Name</FormLabel> {/* Added Sr Label */}
                                        <FormControl><Input placeholder="Rule Name" {...ruleField} disabled={isSubmitting} className="h-9" /></FormControl>
                                        <FormMessage className="text-xs" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`rules.${index}.points`}
                                    render={({ field: ruleField }) => (
                                        <FormItem className="w-20">
                                         <FormLabel className="sr-only">Points</FormLabel> {/* Added Sr Label */}
                                        <FormControl><Input type="number" placeholder="Pts" {...ruleField} min="0" step="1" disabled={isSubmitting} className="h-9" /></FormControl>
                                        <FormMessage className="text-xs" />
                                        </FormItem>
                                    )}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:bg-destructive/10 mt-0.5 h-9 w-9" // Adjusted margin/size
                                    onClick={() => remove(index)}
                                    disabled={isSubmitting}
                                    aria-label="Remove rule"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                 )}
                  {/* Display error message for the overall rules array (e.g., "at least one rule required") */}
                  {/* Display error message for the overall rules array only if touched and invalid */}
                    {form.formState.errors.rules?.root && (
                        <p className="text-sm font-medium text-destructive">{form.formState.errors.rules.root.message}</p>
                    )}

            </div>


        </form>
      </ScrollArea>

      {/* Footer outside the scroll area */}
      <DialogFooter className="mt-4 pt-4 border-t">
        <DialogClose asChild>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="button" onClick={form.handleSubmit(handleFormSubmit)} disabled={isSubmitting || isLoadingRules}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isSubmitting ? 'Saving...' : (mode === 'add' ? 'Add Competition' : 'Update Competition')}
        </Button>
      </DialogFooter>
    </Form>
  );
}