
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, setDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Loader2, Save, Settings, GripVertical, PlusCircle, Trash2, AlertCircle } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from "@/components/ui/switch";
import { Input } from '@/components/ui/input';
import { KpiQuestLexicalEditor } from '@/components/LexicalEditor';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from '@/components/ui/separator';

// --- Zod Schema Definitions ---

const externalLinkSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required.'),
  url: z.string().url('Must be a valid URL.'),
});
export type ExternalLink = z.infer<typeof externalLinkSchema>;

// Base for all widgets
const baseWidgetSchema = z.object({
  id: z.string(),
  name: z.string(),
  isEnabled: z.boolean(),
});

// Specific widget types for the discriminated union
const standardWidgetSchema = baseWidgetSchema.extend({ type: z.literal('standard') });
const motdWidgetSchema = baseWidgetSchema.extend({
  type: z.literal('motd'),
  id: z.literal('motd'),
  emoji: z.string().min(1, 'Emoji is required.').max(10, 'Emoji should be short.'),
  content: z.string().min(1, 'Message content is required.'),
});
const linksWidgetSchema = baseWidgetSchema.extend({
  type: z.literal('links'),
  id: z.literal('links'),
  links: z.array(externalLinkSchema),
});
const sidebarWidgetSchema = baseWidgetSchema.extend({
    type: z.literal('sidebar'),
    id: z.string(), // e.g., rps-game, agent-guide
});


// The discriminated union
const widgetSchema = z.discriminatedUnion("type", [
  standardWidgetSchema,
  motdWidgetSchema,
  linksWidgetSchema,
  sidebarWidgetSchema,
]);
export type Widget = z.infer<typeof widgetSchema>;

const dashboardSettingsSchema = z.object({
  widgets: z.array(widgetSchema),
});

// Type for form data
type DashboardSettingsFormData = z.infer<typeof dashboardSettingsSchema>;

// Type for data stored in Firestore
export interface DashboardSettingsData extends DashboardSettingsFormData {
  updatedAt: Timestamp;
  updatedBy: string;
}

const SETTINGS_DOC_ID = "agentDashboardSettings";
const SETTINGS_COLLECTION = "settings";


// --- Sortable Item Components ---

function SortableWidgetItem({ widget, index, control, remove, append, moveLink }: { widget: Widget; index: number; control: any, remove: (index: number) => void, append: any, moveLink: (from: number, to: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: widget.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border p-3 shadow-sm bg-card/50">
      <FormField
        control={control}
        name={`widgets.${index}.isEnabled`}
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" size="icon" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing"><GripVertical className="h-5 w-5"/></Button>
              <div className="space-y-0.5">
                <FormLabel>{widget.name}</FormLabel>
              </div>
            </div>
            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
          </FormItem>
        )}
      />

       {/* Conditional settings based on widget type */}
       {widget.type === 'motd' && form.watch(`widgets.${index}.isEnabled`) && (
        <div className="mt-4 pt-4 border-t space-y-4">
          <FormField control={control} name={`widgets.${index}.emoji`} render={({ field }) => (<FormItem><FormLabel>Emoji</FormLabel><FormControl><Input {...field} className="max-w-xs" /></FormControl><FormMessage /></FormItem>)}/>
          <FormField control={control} name={`widgets.${index}.content`} render={({ field }) => (<FormItem><FormLabel>Content</FormLabel><FormControl><KpiQuestLexicalEditor initialHtml={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)}/>
        </div>
      )}

      {widget.type === 'links' && form.watch(`widgets.${index}.isEnabled`) && (
         <div className="mt-4 pt-4 border-t space-y-4">
             <LinksEditor nestIndex={index} control={control} remove={remove} append={append} move={moveLink} />
         </div>
      )}

    </div>
  );
}

function LinksEditor({ nestIndex, control, remove, append, move } : { nestIndex: number, control: any, remove: any, append: any, move: any }) {
    const { fields: linkFields, append: appendLink, remove: removeLink, move: moveLink } = useFieldArray({
        control,
        name: `widgets.${nestIndex}.links`,
        keyName: 'fieldId',
    });

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (over && active.id !== over.id) {
          const oldIndex = (active.data.current?.sortable.index) as number;
          const newIndex = (over.data.current?.sortable.index) as number;
          moveLink(oldIndex, newIndex);
        }
    }

    return (
        <div className="space-y-4">
            <FormDescription>Add and reorder external links for the agent sidebar.</FormDescription>
            {linkFields.length === 0 && <div className="text-center text-muted-foreground py-4 border-dashed border-2 rounded-md"><AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2"/><p>No links added yet. Click below to add one.</p></div>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={linkFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                {linkFields.map((field, index) => (
                    <SortableLinkItem key={field.id} link={field as any} nestIndex={nestIndex} index={index} remove={removeLink} control={control}/>
                ))}
                </SortableContext>
            </DndContext>
            <Button type="button" variant="outline" size="sm" onClick={() => appendLink({ id: `new-${Date.now()}`, title: '', url: '' })}><PlusCircle className="mr-2 h-4 w-4"/>Add Link</Button>
        </div>
    );
}

function SortableLinkItem({ link, nestIndex, index, remove, control }: { link: ExternalLink, nestIndex: number, index: number; remove: (index: number) => void; control: any }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: link.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    return (
        <div ref={setNodeRef} style={style} className="flex items-end gap-2 border p-3 rounded-md bg-background/50">
            <Button type="button" variant="ghost" size="icon" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing"><GripVertical className="h-5 w-5"/></Button>
            <FormField control={control} name={`widgets.${nestIndex}.links.${index}.title`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Title</FormLabel><FormControl><Input {...field} placeholder="e.g., Company SharePoint" /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={control} name={`widgets.${nestIndex}.links.${index}.url`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>URL</FormLabel><FormControl><Input {...field} placeholder="https://..." /></FormControl><FormMessage /></FormItem>)} />
            <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>
        </div>
    );
}


let form: any; // Define form at a higher scope to be accessible in SortableWidgetItem

export default function AgentDashboardSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);

  form = useForm<DashboardSettingsFormData>({
    resolver: zodResolver(dashboardSettingsSchema),
    defaultValues: {
      widgets: [],
    },
  });

  const { fields: widgetFields, move: moveWidget, append: appendWidget, remove: removeWidget } = useFieldArray({ control: form.control, name: "widgets", keyName: "fieldId" });
  const { fields: linkFields, append: appendLink, remove: removeLink, move: moveLink } = useFieldArray({ control: form.control, name: "widgets.1.links" as any, keyName: "fieldId" }); // Dummy, logic moved

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUserUid(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const settingsDocRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
      const docSnap = await getDoc(settingsDocRef);
      
      const defaultWidgets: Widget[] = [
        { id: 'motd', name: "Message of the Day", type: 'motd', isEnabled: true, emoji: '🎉', content: '<p>Welcome!</p>' },
        { id: 'achievements', name: "Today's Achievements", type: 'standard', isEnabled: true },
        { id: 'pod-targets', name: "Pod Targets", type: 'standard', isEnabled: true },
        { id: 'leaderboards', name: "Competition Leaderboards", type: 'standard', isEnabled: true },
        { id: 'links', name: "External Links", type: 'links', isEnabled: false, links: [] },
        { id: 'rps-game', name: "Sidebar: RPS Game Page", type: 'sidebar', isEnabled: true },
        { id: 'agent-guide', name: "Sidebar: Agent Guide", type: 'sidebar', isEnabled: true },
      ];

      if (docSnap.exists()) {
        const data = docSnap.data() as DashboardSettingsData;
        const savedWidgets = Array.isArray(data.widgets) ? data.widgets : [];
        
        // Merge saved data with defaults, preserving order from saved data
        const savedWidgetMap = new Map(savedWidgets.map(w => [w.id, w]));
        const finalWidgets = savedWidgets.map(sw => {
            const defaultWidget = defaultWidgets.find(dw => dw.id === sw.id);
            return defaultWidget ? { ...defaultWidget, ...sw } : sw;
        });

        // Add any new default widgets that weren't in the saved data
        defaultWidgets.forEach(dw => {
            if (!savedWidgetMap.has(dw.id)) {
                finalWidgets.push(dw);
            }
        });

        form.reset({ widgets: finalWidgets });
      } else {
        form.reset({ widgets: defaultWidgets });
      }
    } catch (error) {
      console.error("Error fetching dashboard settings:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load settings." });
    } finally {
      setIsLoading(false);
    }
  }, [form, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveChanges = async (data: DashboardSettingsFormData) => {
    if (!currentUserUid) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in to save." });
      return;
    }
    setIsSaving(true);
    try {
      const settingsDocRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
      const dataToSave: DashboardSettingsData = {
        ...data,
        updatedAt: serverTimestamp() as Timestamp,
        updatedBy: currentUserUid,
      };
      await setDoc(settingsDocRef, dataToSave);
      toast({ title: "Success", description: "Agent dashboard settings have been updated." });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not save settings." });
    } finally {
      setIsSaving(false);
    }
  };

  function handleDragEnd(event: DragEndEvent, moveFn: (from: number, to: number) => void) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = (active.data.current?.sortable.index) as number;
      const newIndex = (over.data.current?.sortable.index) as number;
      moveFn(oldIndex, newIndex);
    }
  }


  if (isLoading) {
      return (
          <div className="space-y-6">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-12 w-32 self-end" />
          </div>
      );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSaveChanges)} className="space-y-8">
        <Card className="frosted-glass">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-primary" /> Agent Dashboard Settings</CardTitle>
                <CardDescription>Control the components and links that appear on the agent dashboard. Drag and drop to reorder.</CardDescription>
            </CardHeader>
             <CardContent>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, moveWidget)}>
                    <SortableContext items={widgetFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                        {widgetFields.map((field, index) => (
                            <SortableWidgetItem
                                key={field.id}
                                widget={field as Widget}
                                index={index}
                                control={form.control}
                                remove={removeWidget}
                                append={appendLink}
                                moveLink={moveLink}
                            />
                        ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save All Settings'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
