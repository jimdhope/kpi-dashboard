
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
import { Loader2, Save, Settings, GripVertical, PlusCircle, Trash2, AlertCircle, Rows, GripHorizontal } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from "@/components/ui/switch";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KpiQuestLexicalEditor } from '@/components/LexicalEditor';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

// --- Zod Schema Definitions ---

const baseWidgetSchema = z.object({
  id: z.string(), // Unique instance ID for the widget in the layout
  widgetType: z.string(), // e.g., 'motd', 'leaderboards' - defines the component to render
});
export type BaseWidget = z.infer<typeof baseWidgetSchema>;

const rowSchema = z.object({
  id: z.string(), // Unique ID for the row
  widgets: z.array(baseWidgetSchema),
});
export type Row = z.infer<typeof rowSchema>;

const dashboardSettingsSchema = z.object({
  // The main data structure is now an array of rows
  rows: z.array(rowSchema),

  // We still need to store the configuration data for each widget type
  // This data is separate from the layout structure
  motd: z.object({
    isEnabled: z.boolean(),
    emoji: z.string().min(1, 'Emoji is required.').max(10, 'Emoji should be short.'),
    content: z.string().min(1, 'Message content is required.'),
  }),
  leaderboards: z.object({
    isEnabled: z.boolean(),
  }),
  // Add other widget configs here as they become configurable
  // e.g. links, achievements, pod-targets
});

// Type for form data
type DashboardSettingsFormData = z.infer<typeof dashboardSettingsSchema>;

// Type for data stored in Firestore
export interface DashboardSettingsData extends DashboardSettingsFormData {
  updatedAt: Timestamp;
  updatedBy: string;
}

const SETTINGS_DOC_ID = "agentDashboardSettings_v2"; // Use a new doc ID for the new structure
const SETTINGS_COLLECTION = "settings";

// --- Available Widgets Toolbox ---
const AVAILABLE_WIDGETS = [
  { id: 'motd', name: 'Message of the Day' },
  { id: 'achievements', name: 'Today\'s Achievements' },
  { id: 'pod-targets', name: 'Pod Targets' },
  { id: 'leaderboards', name: 'Leaderboards' },
];

function DraggableWidget({ id, name }: { id: string; name: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `toolbox-${id}`,
    data: { widgetType: id, name: name },
  });

  return (
    <Button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      variant="outline"
      size="sm"
      className={cn("cursor-grab", isDragging && "opacity-50")}
    >
      <GripHorizontal className="mr-2 h-4 w-4" />
      {name}
    </Button>
  );
}


export default function AgentDashboardSettingsPage() {
    // ... main component state and effects
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);


     const form = useForm<DashboardSettingsFormData>({
        resolver: zodResolver(dashboardSettingsSchema),
        defaultValues: {
            rows: [],
            motd: { isEnabled: true, emoji: '🎉', content: '<p>Welcome!</p>' },
            leaderboards: { isEnabled: true },
        },
    });

     const { fields: rowFields, append: appendRow, remove: removeRow, move: moveRow, update: updateRow } = useFieldArray({
        control: form.control,
        name: "rows",
        keyName: "fieldId",
    });

    // Fetch and set up form data
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
                    // Initialize with one empty row if no settings exist
                    form.reset({
                        rows: [{ id: `row-${Date.now()}`, widgets: [] }],
                        motd: { isEnabled: true, emoji: '🎉', content: '<p>Welcome!</p>' },
                        leaderboards: { isEnabled: true },
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

    const findContainer = (id: UniqueIdentifier) => {
        if (id === 'toolbox') {
            return 'toolbox';
        }
        return rowFields.find(row => row.id === id || row.widgets.some(w => w.id === id));
    };


    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id);
    };

    const handleDragOver = (event: DragEndEvent) => {
        const { active, over } = event;
        const activeId = active.id;
        const overId = over?.id;

        if (!overId) return;

        const activeContainer = findContainer(activeId);
        const overContainer = findContainer(overId);

        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            return;
        }

        // Dragging from toolbox to a row
        if (active.id.toString().startsWith('toolbox-')) {
             const overRowIndex = rowFields.findIndex(row => row.id === overId);
             if (overRowIndex !== -1) {
                 const newWidget: BaseWidget = {
                    id: `widget-${Date.now()}`, // Unique instance ID
                    widgetType: active.data.current?.widgetType,
                 };

                  const newRows = [...rowFields];
                  newRows[overRowIndex].widgets.push(newWidget);
                  form.setValue('rows', newRows, { shouldDirty: true });
             }
             return;
        }
    };


    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) {
            setActiveId(null);
            return;
        }

        // Reordering rows
        if (active.id.toString().startsWith('row-') && over.id.toString().startsWith('row-')) {
             const oldIndex = rowFields.findIndex(row => row.id === active.id);
             const newIndex = rowFields.findIndex(row => row.id === over.id);
             if (oldIndex !== newIndex) {
                 moveRow(oldIndex, newIndex);
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
                             <CardDescription>Drag widgets from the toolbox into the rows below to build the agent dashboard.</CardDescription>
                        </div>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            {isSaving ? 'Saving...' : 'Save Layout'}
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {/* Widget Toolbox */}
                        <div className="mb-6">
                            <Label className="text-sm font-medium">Widget Toolbox</Label>
                            <Card className="mt-2 p-3 bg-muted/50">
                                <div className="flex flex-wrap gap-2">
                                {AVAILABLE_WIDGETS.map(widget => (
                                    <DraggableWidget key={widget.id} id={widget.id} name={widget.name} />
                                ))}
                                </div>
                            </Card>
                        </div>

                         <Separator className="my-6" />

                        {/* Layout Editor */}
                        <div className="space-y-4">
                              <SortableContext items={rowFields.map(row => row.id)} strategy={verticalListSortingStrategy}>
                                 {rowFields.map((row, index) => (
                                     <DroppableRow key={row.id} row={row} rowIndex={index} removeRow={removeRow} control={form.control} />
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


function DroppableRow({ row, rowIndex, removeRow, control }: { row: Row; rowIndex: number; removeRow: (index: number) => void; control: any }) {
    const { setNodeRef, isOver } = useDroppable({ id: row.id });
    const { attributes, listeners, setNodeRef: setSortableNodeRef, transform, transition } = useSortable({ id: row.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    
    const { fields: widgetFields, remove: removeWidget, move: moveWidget } = useFieldArray({
        control,
        name: `rows.${rowIndex}.widgets`
    });

    return (
        <div ref={setSortableNodeRef} style={style} className="p-4 border rounded-lg bg-background shadow-sm space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="icon" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing"><GripVertical className="h-5 w-5"/></Button>
                    <Label className="font-medium">Row {rowIndex + 1}</Label>
                </div>
                <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeRow(rowIndex)}><Trash2 className="h-4 w-4"/></Button>
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
                        <SortableWidget key={widget.id} widget={widget as BaseWidget} onRemove={() => removeWidget(widgetIndex)} />
                    ))}
                 </SortableContext>

                 {widgetFields.length === 0 && <p className="text-sm text-muted-foreground">Drop a widget here</p>}
            </div>
        </div>
    )
}

function SortableWidget({ widget, onRemove }: { widget: BaseWidget, onRemove: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: widget.id });
    const style = { transform: CSS.Transform.toString(transform), transition, };
    const widgetInfo = AVAILABLE_WIDGETS.find(w => w.id === widget.widgetType);

    return (
        <div ref={setNodeRef} style={style} className="relative p-2 border rounded-md bg-card shadow-sm flex-1 min-w-[200px]">
            <Button {...attributes} {...listeners} variant="ghost" size="icon" className="absolute top-1 left-1 h-6 w-6 cursor-grab active:cursor-grabbing"><GripHorizontal className="h-4 w-4 text-muted-foreground" /></Button>
            <Button onClick={onRemove} variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
            <p className="text-center text-sm font-medium pt-6 pb-2">{widgetInfo?.name || 'Unknown Widget'}</p>
        </div>
    )
}
