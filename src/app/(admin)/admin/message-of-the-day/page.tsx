
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, setDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Loader2, Save, Settings, GripVertical, PlusCircle, Trash2, AlertCircle, Rows, GripHorizontal, Grip } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from "@/components/ui/switch";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KpiQuestLexicalEditor } from '@/components/LexicalEditor';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus } from 'lucide-react';


// --- Zod Schema Definitions ---
export type WidgetType = 'motd' | 'achievements' | 'pod-targets' | 'leaderboard-agent' | 'leaderboard-team' | 'leaderboard-pod' | 'links' | 'sidebar-rps-game' | 'sidebar-agent-guide';


const baseWidgetSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(), // e.g., 'motd', 'leaderboard'
  isEnabled: z.boolean(),
});

const motdWidgetSchema = baseWidgetSchema.extend({
  type: z.literal('motd'),
  emoji: z.string().min(1, 'Emoji is required.').max(10, 'Emoji should be short.'),
  content: z.string().min(1, 'Message content is required.'),
});

const linksWidgetSchema = baseWidgetSchema.extend({
    type: z.literal('links'),
    links: z.array(z.object({
        id: z.string(),
        title: z.string().min(1, 'Link title is required.'),
        url: z.string().url('Please enter a valid URL.'),
    })),
});

const leaderboardWidgetSchema = baseWidgetSchema.extend({
  type: z.literal('leaderboards'), // This is now legacy, prefer individual types
  leaderboardTypes: z.array(z.object({
      id: z.enum(['agent', 'team', 'pod']),
      name: z.string(),
      isEnabled: z.boolean(),
  })),
});

const sidebarWidgetSchema = baseWidgetSchema.extend({
    type: z.enum(['sidebar-rps-game', 'sidebar-agent-guide']),
});


const standardWidgetSchema = baseWidgetSchema.extend({
    type: z.enum(['achievements', 'pod-targets', 'leaderboard-agent', 'leaderboard-team', 'leaderboard-pod']),
});


// A discriminated union to handle different widget types
const widgetSchema = z.discriminatedUnion('type', [
    motdWidgetSchema,
    linksWidgetSchema,
    leaderboardWidgetSchema,
    sidebarWidgetSchema,
    standardWidgetSchema,
]);

export type Widget = z.infer<typeof widgetSchema>;

export const rowSchema = z.object({
  id: z.string(), // Unique ID for the row
  widgets: z.array(widgetSchema),
});
export type Row = z.infer<typeof rowSchema>;

const dashboardSettingsSchema = z.object({
  rows: z.array(rowSchema),
});

// Type for form data
type DashboardSettingsFormData = z.infer<typeof dashboardSettingsSchema>;

// Type for data stored in Firestore
export interface DashboardSettingsData extends DashboardSettingsFormData {
  updatedAt: Timestamp;
  updatedBy: string;
}

const SETTINGS_DOC_ID = "agentDashboardSettings_v3"; // Use a new doc ID for the new structure
const SETTINGS_COLLECTION = "settings";


// --- Available Widgets Toolbox ---
const AVAILABLE_WIDGETS: { id: WidgetType; name: string }[] = [
    { id: 'motd', name: 'Message of the Day' },
    { id: 'achievements', name: 'Today\'s Achievements' },
    { id: 'pod-targets', name: 'Pod Targets' },
    { id: 'leaderboard-agent', name: 'Agent Leaderboard' },
    { id: 'leaderboard-team', name: 'Team Leaderboard' },
    { id: 'leaderboard-pod', name: 'Pod Leaderboard' },
    { id: 'links', name: 'External Links' },
    { id: 'sidebar-rps-game', name: 'Sidebar: RPS Game Page' },
    { id: 'sidebar-agent-guide', name: 'Sidebar: Agent Guide' },
];


export default function AgentDashboardSettingsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);


     const form = useForm<DashboardSettingsFormData>({
        resolver: zodResolver(dashboardSettingsSchema),
        defaultValues: { rows: [] },
    });

     const { fields: rowFields, append: appendRow, remove: removeRow, move: moveRow } = useFieldArray({
        control: form.control,
        name: "rows",
        keyName: "fieldId",
    });

    const getWidgetDefaultData = (widgetType: WidgetType, widgetName: string): Omit<Widget, 'id' | 'name'> => {
        switch (widgetType) {
            case 'motd':
                return { type: 'motd', isEnabled: true, emoji: '🎉', content: '<p>Welcome!</p>' };
            case 'links':
                return { type: 'links', isEnabled: true, links: [] };
             case 'leaderboards': // This is now legacy, but keep for safety. Use individual types below.
                return {
                    type: 'leaderboards',
                    isEnabled: true,
                    leaderboardTypes: [
                        { id: 'agent', name: 'Agent Leaderboard', isEnabled: true },
                        { id: 'team', name: 'Team Leaderboard', isEnabled: true },
                    ],
                };
             case 'sidebar-rps-game':
             case 'sidebar-agent-guide':
                return { type: widgetType, isEnabled: true };
            case 'achievements':
            case 'pod-targets':
            case 'leaderboard-agent':
            case 'leaderboard-team':
            case 'leaderboard-pod':
                return { type: widgetType, isEnabled: true };
            default: // Fallback for any other standard type
                 return { type: 'achievements', isEnabled: true }; // Fallback to a safe standard type
        }
    };


     useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            setCurrentUserUid(user?.uid || null);
        });

        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const settingsDocRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
                const docSnap = await getDoc(settingsDocRef);
                if (docSnap.exists()) {
                    form.reset(docSnap.data() as DashboardSettingsData);
                } else {
                    form.reset({
                        rows: [{ id: `row-${Date.now()}`, widgets: [] }],
                    });
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not load settings." });
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
        return () => unsubscribe();
    }, [form, toast]);


    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const findContainer = (id: UniqueIdentifier): string | null => {
        for (const row of rowFields) {
            if (row.id === id) return row.id;
            if (row.widgets.some(w => w.id === id)) return row.id;
        }
        return null;
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id);
    };

    const handleDragOver = (event: DragEndEvent) => {
        const { active, over } = event;
        const overId = over?.id;

        if (!overId || active.id === overId) return;

        const activeContainerId = findContainer(active.id);
        const overContainerId = findContainer(over.id);
        
        if (!activeContainerId || !overContainerId || activeContainerId === overContainerId) {
            return;
        }

        const newRows = form.getValues('rows');
        const activeRowIndex = newRows.findIndex(r => r.id === activeContainerId);
        const overRowIndex = newRows.findIndex(r => r.id === overContainerId);

        if (activeRowIndex === -1 || overRowIndex === -1) return;

        const activeWidgetIndex = newRows[activeRowIndex].widgets.findIndex(w => w.id === active.id);
        
        if (activeWidgetIndex !== -1) {
            const [movedWidget] = newRows[activeRowIndex].widgets.splice(activeWidgetIndex, 1);
            
            const overItems = newRows[overRowIndex].widgets;
            const overWidgetIndex = overId.toString().startsWith('widget-')
                ? overItems.findIndex(w => w.id === overId)
                : (overId.toString().startsWith('row-') ? overItems.length : -1);

            if (overWidgetIndex !== -1) {
                newRows[overRowIndex].widgets.splice(overWidgetIndex, 0, movedWidget);
                form.setValue('rows', newRows, { shouldDirty: true });
            }
        }
    };


    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        const overId = over?.id;

        if (!overId) {
            setActiveId(null);
            return;
        }
        
        const activeContainerId = findContainer(active.id);
        const overContainerId = findContainer(over.id);
        const newRows = form.getValues('rows');

        if (activeContainerId && overContainerId && activeContainerId === overContainerId) {
             const rowIndex = newRows.findIndex(r => r.id === activeContainerId);
             const oldIndex = newRows[rowIndex].widgets.findIndex(w => w.id === active.id);
             const newIndex = newRows[rowIndex].widgets.findIndex(w => w.id === over.id);
             if(oldIndex !== newIndex){
                 newRows[rowIndex].widgets = arrayMove(newRows[rowIndex].widgets, oldIndex, newIndex);
                 form.setValue('rows', newRows, { shouldDirty: true });
             }
        } else if (activeContainerId && overContainerId && activeContainerId !== overContainerId) {
            // Already handled by onDragOver
        }

        if(active.id.toString().startsWith('row-') && over.id.toString().startsWith('row-')){
             const oldIndex = newRows.findIndex(r => r.id === active.id);
             const newIndex = newRows.findIndex(r => r.id === over.id);
             if(oldIndex !== newIndex) {
                const movedRows = arrayMove(newRows, oldIndex, newIndex);
                form.setValue('rows', movedRows, { shouldDirty: true });
             }
        }

        setActiveId(null);
    };


    const handleAddNewRow = () => {
        appendRow({ id: `row-${Date.now()}`, widgets: [] });
    };

    const handleSaveChanges = async (data: DashboardSettingsFormData) => {
         setIsSaving(true);
         try {
            const settingsDocRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
            const dataToSave: DashboardSettingsData = {
                ...data,
                updatedAt: serverTimestamp() as Timestamp,
                updatedBy: currentUserUid!,
            };
            await setDoc(settingsDocRef, dataToSave);
            toast({ title: "Success", description: "Dashboard layout saved." });
        } catch (error) {
            console.error("Error saving settings:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not save settings." });
        } finally {
            setIsSaving(false);
        }
    }


    if (isLoading) {
        return <Skeleton className="h-96 w-full" />;
    }

    return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveChanges)} className="space-y-8">
                <Card className="frosted-glass">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                             <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-primary" /> Agent Dashboard Layout</CardTitle>
                             <CardDescription>Drag and drop widgets to arrange the agent dashboard.</CardDescription>
                        </div>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            {isSaving ? 'Saving...' : 'Save Layout'}
                        </Button>
                    </CardHeader>
                    <CardContent>
                         <Separator className="my-6" />
                        {/* Layout Editor */}
                        <div className="space-y-4">
                              <SortableContext items={rowFields.map(row => row.id)} strategy={verticalListSortingStrategy}>
                                 {rowFields.map((row, index) => (
                                     <DroppableRow
                                         key={row.id}
                                         row={row as Row}
                                         rowIndex={index}
                                         form={form}
                                         getWidgetDefaultData={getWidgetDefaultData}
                                      />
                                 ))}
                              </SortableContext>
                        </div>

                         <Button variant="outline" size="sm" type="button" onClick={handleAddNewRow} className="mt-6">
                            <Rows className="mr-2 h-4 w-4" /> Add Row
                         </Button>

                    </CardContent>
                </Card>
            </form>
        </Form>
    </DndContext>
    );
}

function DroppableRow({ row, rowIndex, form, getWidgetDefaultData }: { row: Row; rowIndex: number; form: any; getWidgetDefaultData: (type: WidgetType, name: string) => any; }) {
    const { setNodeRef, isOver } = useDroppable({ id: row.id });
    const { control, setValue } = form;
    const { remove: removeRow, update: updateRow } = useFieldArray({ control, name: 'rows' });
    const { fields: widgetFields, remove: removeWidget, append: appendWidget } = useFieldArray({ control, name: `rows.${rowIndex}.widgets` });
    const { attributes, listeners, setNodeRef: setSortableNodeRef, transform, transition } = useSortable({ id: row.id });

    const style = { transform: CSS.Transform.toString(transform), transition };
    
    const handleAddWidget = (widgetType: WidgetType) => {
        const widgetInfo = AVAILABLE_WIDGETS.find(w => w.id === widgetType);
        if (widgetInfo) {
            const defaultData = getWidgetDefaultData(widgetType, widgetInfo.name);
            const newWidget: Widget = {
                id: `widget-${Date.now()}`,
                name: widgetInfo.name,
                ...defaultData,
            } as Widget;
            appendWidget(newWidget);
        }
    };

    return (
        <div ref={setSortableNodeRef} style={style} className="p-4 border rounded-lg bg-background shadow-sm space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="icon" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing"><GripVertical className="h-5 w-5"/></Button>
                    <Label className="font-medium">Row {rowIndex + 1}</Label>
                </div>
                <div className="flex items-center gap-2">
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm"><PlusCircle className="mr-2 h-4 w-4"/> Add Widget</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {AVAILABLE_WIDGETS.map(widget => (
                                <DropdownMenuItem key={widget.id} onSelect={() => handleAddWidget(widget.id)}>
                                    {widget.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeRow(rowIndex)}><Trash2 className="h-4 w-4"/></Button>
                </div>
            </div>
            <div
                ref={setNodeRef}
                className={cn(
                    "min-h-[6rem] p-4 border-2 border-dashed rounded-md flex flex-wrap items-start gap-4",
                    isOver ? 'border-primary bg-primary/10' : 'border-muted-foreground/30 bg-muted/20'
                )}
            >
                 <SortableContext items={widgetFields.map(w => w.id)} strategy={horizontalListSortingStrategy}>
                    {widgetFields.map((widget, widgetIndex) => (
                        <SortableWidgetItem key={widget.id} widget={widget as Widget} widgetIndex={widgetIndex} rowIndex={rowIndex} onRemove={() => removeWidget(widgetIndex)} control={control} />
                    ))}
                 </SortableContext>

                 {widgetFields.length === 0 && <p className="text-sm text-muted-foreground">Add a widget to this row</p>}
            </div>
        </div>
    )
}

function SortableWidgetItem({ widget, rowIndex, widgetIndex, onRemove, control }: { widget: Widget, rowIndex: number, widgetIndex: number, onRemove: () => void, control: any }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: widget.id });
    const style = { transform: CSS.Transform.toString(transform), transition, };
    
    const { fields: linkFields, append: appendLink, remove: removeLink } = useFieldArray({
        control,
        name: `rows.${rowIndex}.widgets.${widgetIndex}.links`,
    });

     const { fields: leaderboardFields, move: moveLeaderboard } = useFieldArray({
        control,
        name: `rows.${rowIndex}.widgets.${widgetIndex}.leaderboardTypes`
    });

    const isConfigurable = widget.type === 'motd' || widget.type === 'links' || widget.type === 'leaderboards';

    return (
        <div ref={setNodeRef} style={style} className="relative p-3 border rounded-md bg-card shadow-sm flex-1 min-w-[250px] flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button type="button" variant="ghost" size="icon" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing"><GripVertical className="h-5 w-5"/></Button>
                    <Label htmlFor={`switch-${widget.id}`} className="font-medium">{widget.name}</Label>
                </div>
                 <div className="flex items-center gap-1">
                    <FormField
                        control={control}
                        name={`rows.${rowIndex}.widgets.${widgetIndex}.isEnabled`}
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Switch
                                        id={`switch-${widget.id}`}
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <Button onClick={onRemove} variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                 </div>
            </div>

            {isConfigurable && (
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="settings" className="border-b-0">
                        <AccordionTrigger className="text-sm py-1">Settings</AccordionTrigger>
                        <AccordionContent className="pt-2 space-y-4">
                             {widget.type === 'motd' && (
                                <>
                                 <FormField control={control} name={`rows.${rowIndex}.widgets.${widgetIndex}.emoji`} render={({ field }) => (<FormItem><FormLabel>Emoji</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                 <FormField control={control} name={`rows.${rowIndex}.widgets.${widgetIndex}.content`} render={({ field }) => (<FormItem><FormLabel>Content</FormLabel><FormControl><KpiQuestLexicalEditor initialHtml={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                                </>
                            )}
                             {widget.type === 'links' && (
                                <div className="space-y-2">
                                    {linkFields.map((link, linkIndex) => (
                                        <div key={link.id} className="flex items-end gap-2 p-2 border rounded-md">
                                            <div className="flex-1 space-y-2">
                                                <FormField control={control} name={`rows.${rowIndex}.widgets.${widgetIndex}.links.${linkIndex}.title`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Title</FormLabel><FormControl><Input {...field} placeholder="Link Title" className="h-8"/></FormControl></FormItem>)} />
                                                <FormField control={control} name={`rows.${rowIndex}.widgets.${widgetIndex}.links.${linkIndex}.url`} render={({ field }) => (<FormItem><FormLabel className="text-xs">URL</FormLabel><FormControl><Input {...field} placeholder="https://..." type="url" className="h-8"/></FormControl></FormItem>)} />
                                            </div>
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeLink(linkIndex)}><Trash2 className="h-4 w-4"/></Button>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={() => appendLink({id: `link-${Date.now()}`, title: '', url: ''})}><Plus className="h-4 w-4 mr-2"/>Add Link</Button>
                                </div>
                            )}
                            {widget.type === 'leaderboards' && (
                                <div className="space-y-2">
                                    <FormDescription>Enable and reorder the leaderboards.</FormDescription>
                                    <SortableContext items={leaderboardFields.map(l => l.id)} strategy={verticalListSortingStrategy}>
                                         {leaderboardFields.map((lbField, lbIndex) => {
                                             const SortableItem = ({ children }: { children: React.ReactNode }) => {
                                                 const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lbField.id });
                                                 const style = { transform: CSS.Transform.toString(transform), transition };
                                                 return <div ref={setNodeRef} style={style} {...attributes} {...listeners}>{children}</div>;
                                             };
                                             return (
                                                  <SortableItem key={lbField.id}>
                                                     <div className="flex items-center gap-2 p-2 border rounded-md bg-background">
                                                         <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab"/>
                                                         <FormField
                                                             control={control}
                                                             name={`rows.${rowIndex}.widgets.${widgetIndex}.leaderboardTypes.${lbIndex}.isEnabled`}
                                                             render={({ field }) => (
                                                                <FormItem className="flex-1 flex items-center gap-2 space-y-0">
                                                                     <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                                     <FormLabel className="font-normal">{ (lbField as any).name }</FormLabel>
                                                                </FormItem>
                                                             )}
                                                         />
                                                     </div>
                                                  </SortableItem>
                                             );
                                         })}
                                     </SortableContext>
                                </div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}
        </div>
    )
}
