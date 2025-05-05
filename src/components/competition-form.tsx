
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
import { Checkbox } from "@/components/ui/checkbox"; // Added Checkbox import
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
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
  FormDescription, // Added FormDescription
} from '@/components/ui/form';
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { CalendarIcon, Trash2, PlusCircle, Loader2, AlertCircle } from 'lucide-react';
import { format, parse, isValid as isDateValid, startOfDay, addDays } from 'date-fns'; // Import addDays
import { cn } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import type { Competition } from '@/app/(admin)/admin/competitions/page'; // Import Competition type
import type { Campaign } from '@/app/(admin)/admin/campaigns/page'; // Import Campaign type
import type { Pod } from '@/app/(admin)/admin/pods/page'; // Import Pod type
import { RuleFormData } from '@/components/manage-campaign-rules-dialog'; // Reuse Rule type definition

// --- Zod Schema Definition ---

const DATE_FORMAT_DISPLAY = 'dd/MM/yyyy'; // Display format for input
const DATE_FORMAT_PARSE = 'dd/MM/yyyy'; // Parsing format

// Helper function to parse DD/MM/YYYY string to Date or return null if invalid
const parseDateString = (dateString: string | undefined | null): Date | null => {
  if (!dateString || dateString.length !== 10) return null; // Basic length check
  const parsedDate = parse(dateString, DATE_FORMAT_PARSE, new Date());
  // Check if the parsed date is valid AND if the formatted date matches the input (to catch invalid dates like 31/02/2024)
  return isDateValid(parsedDate) && format(parsedDate, DATE_FORMAT_PARSE) === dateString
    ? startOfDay(parsedDate) // Use startOfDay for consistency
    : null;
};


// Reusable rule schema
const competitionRuleSchema = z.object({
  id: z.string(), // Keep ID for reference/key
  name: z.string().min(1, { message: 'Rule name is required.' }),
  emoji: z.string().optional(),
  points: z.coerce.number().int().min(0, { message: 'Points must be >= 0.' }),
});

// Main competition form schema - REMOVED podTargets
export const competitionFormSchema = z.object({
  name: z.string().min(3, { message: 'Competition name required (min 3 chars).' }).max(50, { message: 'Name max 50 chars.' }),
  campaignId: z.string().min(1, { message: 'Please select a campaign.' }),
  // Changed back to podIds array for consistency with data model
  podIds: z.array(z.string()).min(1, { message: 'Please select at least one pod.' }),
  startDate: z.union([z.date(), z.string()]) // Accept Date or string
    .transform((val) => (typeof val === 'string' ? parseDateString(val) : val)) // Attempt to parse string
    .refine((val): val is Date => val instanceof Date && isDateValid(val), { // Ensure result is a valid Date
      message: `Invalid date. Use ${DATE_FORMAT_DISPLAY} format or picker.`,
    }),
  endDate: z.union([z.date(), z.string()]) // Accept Date or string
    .transform((val) => (typeof val === 'string' ? parseDateString(val) : val)) // Attempt to parse string
    .refine((val): val is Date => val instanceof Date && isDateValid(val), { // Ensure result is a valid Date
        message: `Invalid date. Use ${DATE_FORMAT_DISPLAY} format or picker.`,
    }),
  rules: z.array(competitionRuleSchema).min(1, { message: 'At least one rule is required.' }),
}).refine(data => {
    // Only validate end date if start date is valid
    if (data.startDate instanceof Date && isDateValid(data.startDate)) {
        return data.endDate instanceof Date && isDateValid(data.endDate) && data.endDate >= data.startDate;
    }
    return true; // Skip validation if start date is invalid
  }, {
    message: "End date cannot be before start date.",
    path: ["endDate"],
});


// Type for form data expects Dates after transform - REMOVED podTargets
type CompetitionFormSchemaType = Omit<z.infer<typeof competitionFormSchema>, 'startDate' | 'endDate'> & {
  startDate: Date;
  endDate: Date;
  // podTargets removed
};


// --- Component Props ---

interface CompetitionFormProps {
  onSubmit: (data: CompetitionFormSchemaType, rules: RuleFormData[]) => Promise<void> | void; // Pass rules separately
  onCancel: () => void; // Added onCancel prop
  // Update initialData to accept podIds array
  initialData?: Omit<Competition, 'startDate' | 'endDate'> & { startDate: Date | Timestamp, endDate: Date | Timestamp };
  campaigns: Campaign[];
  pods: Pod[];
  mode: 'add' | 'edit';
}

// --- Helper Functions ---

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
   // State to manage popover visibility
   const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
   const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<CompetitionFormSchemaType>({
    resolver: zodResolver(competitionFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      campaignId: initialData?.campaignId || '',
      // Initialize podIds as an array
      podIds: initialData?.podIds || [],
       // Store dates as Date objects internally
       startDate: initialData?.startDate instanceof Timestamp ? startOfDay(initialData.startDate.toDate()) : initialData?.startDate instanceof Date ? startOfDay(initialData.startDate) : undefined,
       endDate: initialData?.endDate instanceof Timestamp ? startOfDay(initialData.endDate.toDate()) : initialData?.endDate instanceof Date ? startOfDay(initialData.endDate) : undefined,
      rules: initialData?.rules || [],
    },
    mode: 'onBlur', // Change validation mode to onBlur
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'rules',
    keyName: "fieldId", // Use a unique key name other than 'id'
  });

   // --- Effects ---

   useEffect(() => {
    if (initialData && mode === 'edit') {
      form.reset({
        name: initialData.name,
        campaignId: initialData.campaignId,
        // Use podIds array
        podIds: initialData.podIds || [],
        // Ensure dates are Date objects and start of day
        startDate: initialData.startDate instanceof Timestamp ? startOfDay(initialData.startDate.toDate()) : initialData.startDate instanceof Date ? startOfDay(initialData.startDate) : undefined,
        endDate: initialData.endDate instanceof Timestamp ? startOfDay(initialData.endDate.toDate()) : initialData.endDate instanceof Date ? startOfDay(initialData.endDate) : undefined,
        rules: initialData.rules || [],
      });
        replace(initialData.rules || []);
    } else if (mode === 'add') {
        form.reset({
            name: '',
            campaignId: '',
             // Reset podIds as empty array
             podIds: [],
            startDate: undefined,
            endDate: undefined,
            rules: [],
        });
        replace([]); // Clear rules field array
    }
  }, [initialData, mode, form, replace]);

  const watchedCampaignId = form.watch('campaignId');
  const watchedStartDate = form.watch('startDate'); // Watch start date
  const watchedRules = form.watch('rules'); // Watch rules
  const watchedEndDate = form.watch('endDate'); // Watch end date

  useEffect(() => {
    // Load default rules only when campaign changes in 'add' mode
    if (mode === 'add' && watchedCampaignId) {
       const loadRules = async () => {
           setIsLoadingRules(true);
            try {
                const defaultRules = await fetchCampaignRules(watchedCampaignId);
                 const rulesWithKeys = defaultRules.map((rule, index) => ({
                    ...rule,
                    id: rule.id || `new-rule-${index}-${Date.now()}` // Ensure unique key
                 }));
                 replace(rulesWithKeys);
            } catch (e) {
                 toast({ variant: "destructive", title: "Error", description: "Could not load default campaign rules." });
                 replace([]);
            } finally {
                setIsLoadingRules(false);
            }
       };
       loadRules();
    } else if (mode === 'add' && !watchedCampaignId) {
        replace([]);
    }
  }, [mode, watchedCampaignId, replace, toast, form]);

  // Effect to set default end date
   useEffect(() => {
       const currentEndDate = form.getValues('endDate');
       // Only set default if start date is valid and end date is not already set
       if (watchedStartDate instanceof Date && isDateValid(watchedStartDate) && !currentEndDate) {
           const defaultEndDate = addDays(watchedStartDate, 6); // Default to 6 days after start (for a 7-day competition)
            form.setValue('endDate', defaultEndDate, { shouldValidate: true });
       }
   }, [watchedStartDate, form]); // Re-run when startDate changes


  // --- Event Handlers ---

  const handleAddRule = () => {
    append({ id: `new-rule-${Date.now()}-${Math.random()}`, name: '', emoji: '', points: 0 });
  };

   // Handle manual date input change - Update the form with the raw string
   const handleDateInputChange = (
     event: React.ChangeEvent<HTMLInputElement>,
     fieldName: 'startDate' | 'endDate'
   ) => {
     form.setValue(fieldName, event.target.value as any, { shouldValidate: true });
   };

    // Handle date selection from the calendar - Update form with Date object
   const handleDateSelect = (
     date: Date | undefined,
     fieldName: 'startDate' | 'endDate'
   ) => {
     if (date) {
       form.setValue(fieldName, startOfDay(date), { shouldValidate: true }); // Ensure it's start of day
       if (fieldName === 'startDate') setIsStartDatePopoverOpen(false);
       if (fieldName === 'endDate') setIsEndDatePopoverOpen(false);
     }
   };

  const handleFormSubmit = async (data: CompetitionFormSchemaType) => {
    setIsSubmitting(true);
    try {
        // Ensure startDate and endDate are Date objects before submitting
        if (!(data.startDate instanceof Date) || !(data.endDate instanceof Date)) {
          toast({ variant: "destructive", title: "Invalid Date", description: "Please select valid start and end dates." });
          setIsSubmitting(false);
          return;
        }
        const submitData = { ...data };
        await onSubmit(submitData, data.rules); // Pass Zod-transformed data and rules
    } catch (error) {
        console.error("Error during competition form submission:", error);
    } finally {
        setIsSubmitting(false);
    }
  };

  const filteredPods = pods.filter(pod => pod.campaignId === watchedCampaignId);

  // Re-evaluate isStartDateValid inside the render scope
  const isStartDateValid = watchedStartDate instanceof Date && isDateValid(watchedStartDate);


  return (
    <Form {...form}>
      <ScrollArea className="h-[65vh] pr-6">
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="grid gap-6 py-4 pl-2 pr-1">

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
                        form.setValue('podIds', []); // Reset pod selection on campaign change
                    }}
                    value={field.value}
                    disabled={isSubmitting || mode === 'edit'}
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
                 {mode === 'edit' && <FormDescription>Campaign cannot be changed after creation.</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Pod Selection (Multi-Select) */}
          <FormField
             control={form.control}
             name="podIds"
             render={({ field }) => (
               <FormItem>
                 <FormLabel>Participating Pods</FormLabel>
                 <FormControl>
                    {/* Use a multi-select component or checkboxes */}
                    {/* Simple Checkbox Example (replace with a proper multi-select component if needed) */}
                    <div className="space-y-2 rounded-md border p-4 max-h-40 overflow-y-auto">
                         {filteredPods.length === 0 ? (
                             <p className="text-sm text-muted-foreground">
                                 {!watchedCampaignId ? "Select a campaign first" : "No pods found in this campaign."}
                             </p>
                         ) : (
                             filteredPods.map((pod) => (
                                 <div key={pod.id} className="flex items-center gap-2">
                                     <Checkbox
                                         id={`pod-${pod.id}`}
                                         checked={field.value?.includes(pod.id)}
                                         onCheckedChange={(checked) => {
                                             const currentPodIds = field.value || [];
                                             return checked
                                             ? field.onChange([...currentPodIds, pod.id])
                                             : field.onChange(currentPodIds.filter((id) => id !== pod.id));
                                         }}
                                         disabled={isSubmitting}
                                     />
                                     <Label htmlFor={`pod-${pod.id}`} className="font-normal">{pod.name}</Label>
                                 </div>
                             ))
                         )}
                    </div>
                 </FormControl>
                 <FormMessage />
               </FormItem>
             )}
           />


            {/* Start Date - Combined Picker and Input */}
            <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Start Date</FormLabel>
                        <div className="flex items-center gap-2">
                             <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button" // Prevent form submission
                                        variant={"outline"}
                                        className={cn(
                                            "w-[130px] justify-start text-left font-normal",
                                            !(field.value instanceof Date) && "text-muted-foreground"
                                        )}
                                        disabled={isSubmitting}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                                         {field.value instanceof Date ? format(field.value, 'PP') : <span>Pick date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 z-50" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value instanceof Date ? field.value : undefined}
                                        onSelect={(date) => handleDateSelect(date, 'startDate')}
                                        disabled={isSubmitting}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                             <FormControl>
                                <Input
                                    type="text"
                                    placeholder={DATE_FORMAT_DISPLAY}
                                    value={field.value instanceof Date ? format(field.value, DATE_FORMAT_DISPLAY) : field.value || ''}
                                    onChange={(e) => handleDateInputChange(e, 'startDate')}
                                    className="flex-1"
                                    disabled={isSubmitting}
                                    maxLength={10}
                                />
                             </FormControl>
                        </div>
                         <FormMessage />
                    </FormItem>
                )}
            />

            {/* End Date - Combined Picker and Input */}
            <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                     <FormItem className="flex flex-col">
                         {/* Apply error styling directly to the label if end date is invalid */}
                         <FormLabel className={cn(form.formState.errors.endDate && "text-destructive")}>End Date</FormLabel>
                         <div className="flex items-center gap-2">
                            <Popover open={isEndDatePopoverOpen} onOpenChange={setIsEndDatePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button" // Prevent form submission
                                        variant={"outline"}
                                        className={cn(
                                            "w-[130px] justify-start text-left font-normal",
                                            !(field.value instanceof Date) && "text-muted-foreground"
                                        )}
                                         disabled={isSubmitting || !isStartDateValid} // Use recalculated validity
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                                         {field.value instanceof Date ? format(field.value, 'PP') : <span>Pick date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 z-50" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value instanceof Date ? field.value : undefined}
                                        onSelect={(date) => handleDateSelect(date, 'endDate')}
                                        // Only disable dates *before* the start date IF start date is valid
                                         disabled={(date) =>
                                             isSubmitting || !isStartDateValid || !date || (date < watchedStartDate!)
                                         }
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                              <FormControl>
                                 <Input
                                     type="text"
                                     placeholder={DATE_FORMAT_DISPLAY}
                                     value={field.value instanceof Date ? format(field.value, DATE_FORMAT_DISPLAY) : field.value || ''}
                                     onChange={(e) => handleDateInputChange(e, 'endDate')}
                                     className="flex-1"
                                      disabled={isSubmitting || !isStartDateValid} // Use recalculated validity
                                     maxLength={10}
                                 />
                              </FormControl>
                         </div>
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
                <FormDescription>
                   {mode === 'add' ? 'Default rules loaded from campaign. Modify or add rules specific to this competition.' : 'Modify the rules for this specific competition.'}
                </FormDescription>

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
                         {mode === 'add' && !watchedCampaignId && <FormDescription>Select a campaign to load default rules.</FormDescription>}
                         {mode === 'add' && watchedCampaignId && <FormDescription>Add rules manually or check campaign settings.</FormDescription>}
                         {mode === 'edit' && <FormDescription>Add rules manually.</FormDescription>}
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
                                         <FormLabel className="sr-only">Emoji</FormLabel>
                                        <FormControl><Input placeholder={ruleField.value ? "" : "❓"} {...ruleField} maxLength={4} disabled={isSubmitting} className="text-center h-9" /></FormControl>
                                        <FormMessage className="text-xs" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`rules.${index}.name`}
                                    render={({ field: ruleField }) => (
                                        <FormItem className="flex-1">
                                         <FormLabel className="sr-only">Rule Name</FormLabel>
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
                                         <FormLabel className="sr-only">Points</FormLabel>
                                        <FormControl><Input type="number" placeholder="Pts" {...ruleField} min="0" step="1" disabled={isSubmitting} className="h-9" /></FormControl>
                                        <FormMessage className="text-xs" />
                                        </FormItem>
                                    )}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:bg-destructive/10 mt-0.5 h-9 w-9"
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
                    {form.formState.errors.rules?.root && (
                        <FormMessage>{form.formState.errors.rules.root.message}</FormMessage>
                    )}
            </div>

             {/* Pod Targets Section Removed */}

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

