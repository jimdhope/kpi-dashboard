
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
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
import { Loader2, Save, Settings, MessageCircle, BarChart, Link as LinkIcon, Trash2, PlusCircle, AlertCircle, GripVertical } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from "@/components/ui/switch";
import { Input } from '@/components/ui/input';
import { KpiQuestLexicalEditor } from '@/components/LexicalEditor';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// --- Zod Schema Definitions ---
const widgetSchema = z.object({
  id: z.string(),
  name: z.string(),
  isEnabled: z.boolean(),
});

const externalLinkSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required.'),
  url: z.string().url('Must be a valid URL.'),
});

const dashboardSettingsSchema = z.object({
  // Message of the Day settings
  motd: z.object({
    isEnabled: z.boolean(),
    emoji: z.string().min(1, 'Emoji is required.').max(10, 'Emoji should be short.'),
    content: z.string().min(1, 'Message content is required.'),
  }),
  // Widget visibility settings - now an array to store order
  widgets: z.array(widgetSchema),
  // Sidebar page visibility settings
  sidebar: z.object({
    showRpsGame: z.boolean(),
    showAgentGuide: z.boolean(),
    showAdminGuide: z.boolean(),
  }),
  // External Links settings
  externalLinks: z.object({
      isEnabled: z.boolean(),
      links: z.array(externalLinkSchema),
  }),
});

// Type for form data
type DashboardSettingsFormData = z.infer<typeof dashboardSettingsSchema>;
export type Widget = z.infer<typeof widgetSchema>;
export type ExternalLink = z.infer<typeof externalLinkSchema>;


// Type for data stored in Firestore
export interface DashboardSettingsData extends DashboardSettingsFormData {
  updatedAt: Timestamp;
  updatedBy: string;
}

const SETTINGS_DOC_ID = "agentDashboardSettings";
const SETTINGS_COLLECTION = "settings";

// --- Sortable Item Components ---

function SortableLinkItem({ link, index, remove, control }: { link: ExternalLink; index: number; remove: (index: number) => void; control: any }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: link.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    return (
        <div ref={setNodeRef} style={style} className="flex items-end gap-2 border p-3 rounded-md bg-card/30">
            <Button type="button" variant="ghost" size="icon" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing"><GripVertical className="h-5 w-5"/></Button>
            <FormField control={control} name={`externalLinks.links.${index}.title`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Title</FormLabel><FormControl><Input {...field} placeholder="e.g., Company SharePoint" /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={control} name={`externalLinks.links.${index}.url`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>URL</FormLabel><FormControl><Input {...field} placeholder="https://..." /></FormControl><FormMessage /></FormItem>)} />
            <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>
        </div>
    );
}

function SortableWidgetItem({ widget, index, control }: { widget: Widget; index: number; control: any }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: widget.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style}>
      <FormField
        control={control}
        name={`widgets.${index}.isEnabled`}
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-card/50">
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
    </div>
  );
}


export default function AgentDashboardSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);

  const form = useForm<DashboardSettingsFormData>({
    resolver: zodResolver(dashboardSettingsSchema),
    defaultValues: {
      motd: { isEnabled: true, emoji: '🎉', content: '<p><br></p>' },
      widgets: [
        { id: 'achievements', name: "Today's Achievements", isEnabled: true },
        { id: 'pod-targets', name: "Pod Targets", isEnabled: true },
        { id: 'leaderboards', name: "Competition Leaderboards", isEnabled: true },
      ],
      sidebar: { showRpsGame: true, showAgentGuide: true, showAdminGuide: false },
      externalLinks: { isEnabled: false, links: [] },
    },
  });

  const { fields: linkFields, append: appendLink, remove: removeLink, move: moveLink } = useForm({ control: form.control, name: "externalLinks.links" });
  const { fields: widgetFields, move: moveWidget } = useForm({ control: form.control, name: "widgets" });

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
      if (docSnap.exists()) {
        const data = docSnap.data() as DashboardSettingsData;
        const defaultWidgets = [
          { id: 'achievements', name: "Today's Achievements", isEnabled: true },
          { id: 'pod-targets', name: "Pod Targets", isEnabled: true },
          { id: 'leaderboards', name: "Competition Leaderboards", isEnabled: true },
        ];

        // Merge saved widget settings with defaults to handle new widgets
        const savedWidgets = data.widgets || [];
        const widgetMap = new Map(savedWidgets.map(w => [w.id, w]));
        const mergedWidgets = defaultWidgets.map(dw => widgetMap.has(dw.id) ? widgetMap.get(dw.id)! : dw);
        
        form.reset({ ...data, widgets: mergedWidgets });
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
  
  const addNewLink = () => {
      appendLink({ id: `new-${Date.now()}`, title: '', url: '' });
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
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-56 w-full" />
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
        </Card>

        <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3']} className="w-full space-y-4">
          <AccordionItem value="item-1" className="border rounded-lg bg-card/50 frosted-glass">
            <AccordionTrigger className="px-4 py-3 text-lg font-medium"><div className="flex items-center gap-2"><BarChart className="h-5 w-5"/> Dashboard Widgets</div></AccordionTrigger>
            <AccordionContent className="px-4">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, moveWidget)}>
                <SortableContext items={widgetFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {widgetFields.map((field, index) => (
                      <SortableWidgetItem key={field.id} widget={field} index={index} control={form.control} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2" className="border rounded-lg bg-card/50 frosted-glass">
            <AccordionTrigger className="px-4 py-3 text-lg font-medium"><div className="flex items-center gap-2"><MessageCircle className="h-5 w-5"/> Message of the Day</div></AccordionTrigger>
            <AccordionContent className="px-4 space-y-4 pt-4">
              <FormField control={form.control} name="motd.isEnabled" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-card/50"><div className="space-y-0.5"><FormLabel>Enable Message of the Day</FormLabel><FormDescription>Show or hide this widget on the dashboard.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
              <FormField control={form.control} name="motd.emoji" render={({ field }) => (<FormItem><FormLabel>Emoji</FormLabel><FormControl><Input {...field} className="max-w-xs" disabled={!form.watch('motd.isEnabled')} /></FormControl><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="motd.content" render={({ field }) => (<FormItem><FormLabel>Content</FormLabel><FormControl><KpiQuestLexicalEditor initialHtml={field.value} onChange={field.onChange} editable={form.watch('motd.isEnabled')} /></FormControl><FormMessage /></FormItem>)}/>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3" className="border rounded-lg bg-card/50 frosted-glass">
            <AccordionTrigger className="px-4 py-3 text-lg font-medium"><div className="flex items-center gap-2"><LinkIcon className="h-5 w-5"/> External Links</div></AccordionTrigger>
            <AccordionContent className="px-4 space-y-4 pt-4">
              <FormField control={form.control} name="externalLinks.isEnabled" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-card/50"><div className="space-y-0.5"><FormLabel>Enable External Links Section</FormLabel><FormDescription>Show or hide this section in the agent sidebar.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
              {form.watch('externalLinks.isEnabled') && (
                <div className="space-y-4">
                  {linkFields.length === 0 && <div className="text-center text-muted-foreground py-4 border-dashed border-2 rounded-md"><AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2"/><p>No links added yet. Click below to add one.</p></div>}
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, moveLink)}>
                    <SortableContext items={linkFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                      {linkFields.map((field, index) => (
                        <SortableLinkItem key={field.id} link={field} index={index} remove={removeLink} control={form.control}/>
                      ))}
                    </SortableContext>
                  </DndContext>
                  <Button type="button" variant="outline" size="sm" onClick={addNewLink}><PlusCircle className="mr-2 h-4 w-4"/>Add Link</Button>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

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
