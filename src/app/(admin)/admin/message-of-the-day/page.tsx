
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
import { Loader2, Save, Settings, GripVertical, PlusCircle, Trash2, AlertCircle, Rows, GripHorizontal, Grip, MenuSquare } from 'lucide-react';
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
export type WidgetType = 'motd' | 'achievements' | 'pod-targets' | 'leaderboards' | 'links';


const baseWidgetSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
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

const leaderboardsWidgetSchema = baseWidgetSchema.extend({
    type: z.literal('leaderboards'),
    leaderboardTypes: z.array(z.object({
        id: z.enum(['agent', 'team', 'pod']),
        name: z.string(),
        isEnabled: z.boolean(),
    })).min(1, "At least one leaderboard type must be configured."),
});

const standardWidgetSchema = baseWidgetSchema.extend({
    type: z.enum(['achievements', 'pod-targets']),
});


// A discriminated union to handle different widget types
const widgetSchema = z.discriminatedUnion('type', [
    motdWidgetSchema,
    linksWidgetSchema,
    leaderboardsWidgetSchema,
    standardWidgetSchema,
]);

export type Widget = z.infer<typeof widgetSchema>;

export const rowSchema = z.object({
  id: z.string(), // Unique ID for the row
  widgets: z.array(widgetSchema),
});
export type Row = z.infer<typeof rowSchema>;

// New schema for sidebar menu items
const sidebarMenuItemSchema = z.object({
    id: z.enum(['rps-game', 'agent-guide']), // Unique ID for the menu item
    name: z.string(),
    isEnabled: z.boolean(),
});
export type SidebarMenuItem = z.infer<typeof sidebarMenuItemSchema>;

const dashboardSettingsSchema = z.object({
  rows: z.array(rowSchema),
  sidebarMenu: z.array(sidebarMenuItemSchema), // Add sidebar menu settings
});

// Type for form data
type DashboardSettingsFormData = z.infer<typeof dashboardSettingsSchema>;

// Type for data stored in Firestore
export interface DashboardSettingsData extends DashboardSettingsFormData {
  updatedAt: Timestamp;
  updatedBy: string;
}

const SETTINGS_DOC_ID = "agentDashboardSettings_v3";
const SETTINGS_COLLECTION = "settings";


// --- Available Widgets Toolbox ---
const AVAILABLE_WIDGETS: { id: WidgetType; name: string }[] = [
    { id: 'motd', name: 'Message of the Day' },
    { id: 'achievements', name: 'Today\'s Achievements' },
    { id: 'pod-targets', name: 'Pod Targets' },
    { id: 'leaderboards', name: 'Competition Leaderboards' },
    { id: 'links', name: 'External Links' },
];

// Available sidebar menu items
const AVAILABLE_SIDEBAR_ITEMS: SidebarMenuItem[] = [
    { id: 'rps-game', name: 'RPS Game Page', isEnabled: true },
    { id: 'agent-guide', name: 'Agent Guide', isEnabled: true },
];

export default function AgentDashboardSettingsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);


     const form = useForm<DashboardSettingsFormData>({
        resolver: zodResolver(dashboardSettingsSchema),
        defaultValues: { rows: [], sidebarMenu: [] },
    });

     const { fields: rowFields, append: appendRow, remove: removeRow, move: moveRow } = useFieldArray({
        control: form.control,
        name: "rows",
        keyName: "fieldId",
    });

     const { fields: menuFields, replace: replaceMenu } = useFieldArray({
        control: form.control,
        name: "sidebarMenu",
     });

    const getWidgetDefaultData = (widgetType: WidgetType, widgetName: string): Omit<Widget, 'id' | 'name'> => {
        switch (widgetType) {
            case 'motd':
                return { type: 'motd', isEnabled: true, emoji: '🎉', content: '<p>Welcome!</p>' };
            case 'links':
                return { type: 'links', isEnabled: true, links: [] };
            case 'leaderboards':
                return { type: 'leaderboards', isEnabled: true, leaderboardTypes: [
                    { id: 'agent', name: 'Agent Leaderboard', isEnabled: true },
                    { id: 'team', name: 'Team Leaderboard', isEnabled: true },
                    { id: 'pod', name: 'Pod Leaderboard', isEnabled: true },
                ]};
            case 'achievements':
            case 'pod-targets':
                return { type: widgetType, isEnabled: true };
            default:
                 return { type: 'achievements', isEnabled: true };
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
                    const data = docSnap.data() as DashboardSettingsData;
                    // Ensure sidebarMenu exists in fetched data, otherwise use default
                    const sidebarMenuData = data.sidebarMenu && data.sidebarMenu.length > 0 ? data.sidebarMenu : AVAILABLE_SIDEBAR_ITEMS;
                    form.reset({
                        ...data,
                        sidebarMenu: sidebarMenuData,
                    });
                } else {
                    // Set default values for a new setup
                    form.reset({
                        rows: [{ id: `row-${Date.now()}`, widgets: [] }],
                        sidebarMenu: AVAILABLE_SIDEBAR_ITEMS, // Default sidebar items
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
        if (id === 'toolbox') return 'toolbox';
        for (const row of rowFields) {
            if (row.id === id) return row.id;
            if (row.widgets.some(w => w.id === id)) return row.id;
        }
        return null;
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        const activeId = active.id;
        const overId = over?.id;
    
        setActiveId(null);
    
        if (!overId || activeId === overId) {
            return;
        }
    
        const activeContainerId = findContainer(activeId);
        const overContainerId = findContainer(overId);
    
        if (!activeContainerId || !overContainerId) {
            return;
        }
    
        let newRows = [...form.getValues('rows')];
        const activeRowIndex = newRows.findIndex(r => r.id === activeContainerId);
        const overRowIndex = newRows.findIndex(r => r.id === overContainerId);
    
        // Case 1: Dragging from Toolbox to a Row
        if (activeContainerId === 'toolbox' && overContainerId !== 'toolbox') {
            const widgetType = active.id as WidgetType;
            const widgetInfo = AVAILABLE_WIDGETS.find(w => w.id === widgetType);
            if (widgetInfo) {
                const newWidget: Widget = { 
                    id: `widget-${Date.now()}`, 
                    name: widgetInfo.name, 
                    ...(getWidgetDefaultData(widgetType, widgetInfo.name) as any) 
                };
                
                const targetRowIndex = newRows.findIndex(r => r.id === overContainerId);
                if (targetRowIndex !== -1) {
                    const targetWidgets = newRows[targetRowIndex].widgets;
                    const overWidgetIndex = targetWidgets.findIndex(w => w.id === overId);
                    if (overWidgetIndex !== -1) {
                        targetWidgets.splice(overWidgetIndex, 0, newWidget);
                    } else {
                        targetWidgets.push(newWidget);
                    }
                }
            }
        } 
        // Case 2: Reordering within the same row
        else if (activeContainerId === overContainerId && activeContainerId !== 'toolbox') {
            const rowIndex = activeRowIndex;
            if (rowIndex !== -1) {
                const oldIndex = newRows[rowIndex].widgets.findIndex(w => w.id === activeId);
                const newIndex = newRows[rowIndex].widgets.findIndex(w => w.id === overId);
                if (oldIndex !== -1 && newIndex !== -1) {
                    newRows[rowIndex].widgets = arrayMove(newRows[rowIndex].widgets, oldIndex, newIndex);
                }
            }
        } 
        // Case 3: Moving a widget from one row to another
        else if (activeContainerId !== overContainerId && activeContainerId !== 'toolbox') {
            if (activeRowIndex !== -1 && overRowIndex !== -1) {
                const [movedWidget] = newRows[activeRowIndex].widgets.splice(newRows[activeRowIndex].widgets.findIndex(w => w.id === activeId), 1);
                const targetWidgets = newRows[overRowIndex].widgets;
                const overWidgetIndex = targetWidgets.findIndex(w => w.id === overId);
                if (overWidgetIndex !== -1) {
                    targetWidgets.splice(overWidgetIndex, 0, movedWidget);
                } else {
                    targetWidgets.push(movedWidget);
                }
            }
        }
    
        // Case 4: Reordering entire rows
        if (activeId.toString().startsWith('row-') && overId.toString().startsWith('row-')) {
            if (activeRowIndex !== -1 && overRowIndex !== -1) {
                newRows = arrayMove(newRows, activeRowIndex, overRowIndex);
            }
        }
    
        form.setValue('rows', newRows, { shouldDirty: true });
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
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            {/* Layout Editor */}
                            <div className="lg:col-span-3 space-y-4">
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
                                 <Button variant="outline" size="sm" type="button" onClick={handleAddNewRow} className="mt-6">
                                    <Rows className="mr-2 h-4 w-4" /> Add Row
                                 </Button>
                            </div>
                            {/* Widget Toolbox */}
                            <div className="lg:col-span-1">
                                <DroppableToolbox />
                            </div>
                        </div>

                    </CardContent>
                </Card>

                 {/* Sidebar Menu Settings Card */}
                <Card className="frosted-glass">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><MenuSquare className="h-5 w-5 text-primary" /> Sidebar Menu Settings</CardTitle>
                        <CardDescription>Enable or disable pages available in the agent's sidebar menu.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {menuFields.map((item, index) => (
                             <FormField
                                key={item.id}
                                control={form.control}
                                name={`sidebarMenu.${index}.isEnabled`}
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-card/50">
                                        <div className="space-y-0.5">
                                            <FormLabel>{(item as any).name}</FormLabel>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                disabled={isSaving}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        ))}
                    </CardContent>
                </Card>

            </form>
        </Form>
    </DndContext>
    );
}

function DroppableToolbox() {
    const { setNodeRef } = useDroppable({ id: 'toolbox' });
    return (
        <Card ref={setNodeRef} className="lg:sticky lg:top-24">
            <CardHeader>
                <CardTitle className="text-base">Widget Toolbox</CardTitle>
                <CardDescription className="text-xs">Drag a widget into a row on the left.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-2">
                {AVAILABLE_WIDGETS.map(widget => (
                    <DraggableWidget key={widget.id} id={widget.id} name={widget.name} />
                ))}
                </div>
            </CardContent>
        </Card>
    );
}

function DraggableWidget({ id, name }: { id: UniqueIdentifier; name: string }) {
    const { attributes, listeners, setNodeRef } = useDraggable({ id });
    return (
         <div ref={setNodeRef} {...listeners} {...attributes} className="p-2 border rounded-md text-sm cursor-grab bg-card hover:bg-accent shadow-sm active:cursor-grabbing active:shadow-inner">
            {name}
         </div>
    );
}


function DroppableRow({ row, rowIndex, form, getWidgetDefaultData }: { row: Row; rowIndex: number; form: any; getWidgetDefaultData: (type: WidgetType, name: string) => any; }) {
    const { setNodeRef, isOver } = useDroppable({ id: row.id });
    const { control, setValue } = form;
    const { remove: removeRow } = useFieldArray({ control, name: 'rows' });
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
        name: `rows.${rowIndex}.widgets.${widgetIndex}.leaderboardTypes`,
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
                                    {leaderboardFields.map((item, leaderboardIndex) => (
                                        <FormField
                                            key={item.id}
                                            control={control}
                                            name={`rows.${rowIndex}.widgets.${widgetIndex}.leaderboardTypes.${leaderboardIndex}.isEnabled`}
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-2 bg-card/50">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-sm">{(item as any).name}</FormLabel>
                                                    </div>
                                                    <FormControl>
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    ))}
                                </div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}
        </div>
    )
}
