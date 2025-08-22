
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, setDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Loader2, Save, Settings, PlusCircle, Trash2, Rows, View, Columns, X } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from "@/components/ui/switch";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KpiQuestLexicalEditor } from '@/components/LexicalEditor';
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
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// --- Zod Schema Definitions ---

export type WidgetType =
    | 'motd'
    | 'achievements'
    | 'pod-targets'
    | 'leaderboard-agent'
    | 'leaderboard-team'
    | 'leaderboard-pod'
    | 'custom-html';

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

const customHtmlWidgetSchema = baseWidgetSchema.extend({
  type: z.literal('custom-html'),
  content: z.string().min(1, 'HTML content is required.'),
});

const standardWidgetSchema = baseWidgetSchema.extend({
    type: z.enum(['achievements', 'pod-targets', 'leaderboard-agent', 'leaderboard-team', 'leaderboard-pod']),
});


// Discriminated union for specific widget types
const specificWidgetSchema = z.discriminatedUnion('type', [
    motdWidgetSchema,
    customHtmlWidgetSchema,
    standardWidgetSchema,
]);

export type SpecificWidget = z.infer<typeof specificWidgetSchema>;


// A column now holds multiple widgets.
const columnSchema = z.object({
    id: z.string(),
    widgets: z.array(specificWidgetSchema), // Changed from optional widget to array of widgets
});
export type Column = z.infer<typeof columnSchema>;


export const rowSchema = z.object({
  id: z.string(),
  columns: z.array(columnSchema),
});
export type Row = z.infer<typeof rowSchema>;

const sidebarMenuItemSchema = z.object({
    id: z.enum(['rps-game', 'agent-guide']),
    name: z.string(),
    isEnabled: z.boolean(),
});
export type SidebarMenuItem = z.infer<typeof sidebarMenuItemSchema>;

const dashboardSettingsSchema = z.object({
  rows: z.array(rowSchema),
  sidebarMenu: z.array(sidebarMenuItemSchema),
});

type DashboardSettingsFormData = z.infer<typeof dashboardSettingsSchema>;

export interface DashboardSettingsData extends DashboardSettingsFormData {
  updatedAt: Timestamp;
  updatedBy: string;
}

const SETTINGS_DOC_ID = "agentDashboardSettings_v3";
const SETTINGS_COLLECTION = "settings";

const AVAILABLE_WIDGETS: { id: WidgetType; name: string }[] = [
    { id: 'motd', name: 'Message of the Day' },
    { id: 'achievements', name: 'Today\'s Achievements' },
    { id: 'pod-targets', name: 'Pod Targets Today' },
    { id: 'leaderboard-agent', name: 'Agent Leaderboard' },
    { id: 'leaderboard-team', name: 'Team Leaderboard' },
    { id: 'leaderboard-pod', name: 'Pod Leaderboard' },
    { id: 'custom-html', name: 'Custom HTML' },
];

const AVAILABLE_SIDEBAR_ITEMS: SidebarMenuItem[] = [
    { id: 'rps-game', name: 'RPS Game Page', isEnabled: true },
    { id: 'agent-guide', name: 'Agent Guide', isEnabled: true },
];

// --- Main Page Component ---
export default function AgentDashboardSettingsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);

     const form = useForm<DashboardSettingsFormData>({
        resolver: zodResolver(dashboardSettingsSchema),
        defaultValues: { rows: [], sidebarMenu: [] },
    });

     const { fields: rowFields, append: appendRow, remove: removeRow } = useFieldArray({
        control: form.control,
        name: "rows",
        keyName: "fieldId",
    });

     const { fields: menuFields } = useFieldArray({
        control: form.control,
        name: "sidebarMenu",
     });

    const getWidgetDefaultData = (widgetType: WidgetType): SpecificWidget => {
        const base = { id: `widget-${Date.now()}`, isEnabled: true };
        switch (widgetType) {
            case 'motd':
                return { ...base, type: 'motd', name: 'Message of the Day', emoji: '🎉', content: '<p>Welcome!</p>' };
            case 'achievements':
                return { ...base, type: 'achievements', name: 'Today\'s Achievements' };
            case 'pod-targets':
                return { ...base, type: 'pod-targets', name: 'Pod Targets Today' };
            case 'leaderboard-agent':
                return { ...base, type: 'leaderboard-agent', name: 'Agent Leaderboard' };
            case 'leaderboard-team':
                return { ...base, type: 'leaderboard-team', name: 'Team Leaderboard' };
            case 'leaderboard-pod':
                return { ...base, type: 'leaderboard-pod', name: 'Pod Leaderboard' };
            case 'custom-html':
                 return { ...base, type: 'custom-html', name: 'Custom HTML', content: '<p>Your custom content here.</p>' };
            default:
                 // This ensures that all cases are handled. If a new WidgetType is added, TypeScript will error here.
                 const exhaustiveCheck: never = widgetType;
                 throw new Error(`Invalid widget type: ${exhaustiveCheck}`);
        }
    };


     useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(user => setCurrentUserUid(user?.uid || null));

        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const settingsDocRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
                const docSnap = await getDoc(settingsDocRef);
                if (docSnap.exists()) {
                    const data = docSnap.data() as DashboardSettingsData;
                    const sidebarMenuData = data.sidebarMenu && data.sidebarMenu.length > 0 ? data.sidebarMenu : AVAILABLE_SIDEBAR_ITEMS;
                    form.reset({
                        ...data,
                        sidebarMenu: sidebarMenuData,
                    });
                } else {
                    form.reset({ rows: [], sidebarMenu: AVAILABLE_SIDEBAR_ITEMS });
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


    const handleAddNewRow = () => {
        // A new row now defaults to one column with an empty widgets array.
        appendRow({ id: `row-${Date.now()}`, columns: [{ id: `col-${Date.now()}`, widgets: [] }] });
    };

     const handleAddNewColumn = (rowIndex: number) => {
        const rows = form.getValues('rows');
        const targetRow = rows[rowIndex];
        if (targetRow) {
            // New column has an empty widgets array
            const newColumn: Column = { id: `col-${Date.now()}`, widgets: [] };
            const updatedColumns = [...targetRow.columns, newColumn];
            form.setValue(`rows.${rowIndex}.columns`, updatedColumns, { shouldDirty: true });
        }
    };

    const handleAddWidgetToColumn = (rowIndex: number, columnIndex: number, widgetType: WidgetType) => {
        const newWidget = getWidgetDefaultData(widgetType);
        const columnPath = `rows.${rowIndex}.columns.${columnIndex}.widgets`;
        const currentWidgets = form.getValues(columnPath) || [];
        form.setValue(columnPath, [...currentWidgets, newWidget], { shouldDirty: true });
    };

    const handleRemoveWidgetFromColumn = (rowIndex: number, columnIndex: number, widgetIndex: number) => {
         const columnPath = `rows.${rowIndex}.columns.${columnIndex}.widgets`;
         const currentWidgets = form.getValues(columnPath) || [];
         const updatedWidgets = currentWidgets.filter((_, idx) => idx !== widgetIndex);
         form.setValue(columnPath, updatedWidgets, { shouldDirty: true });
    };

     const handleRemoveColumn = (rowIndex: number, columnIndex: number) => {
        const rows = form.getValues('rows');
        const targetRow = rows[rowIndex];
        if (targetRow) {
            const updatedColumns = targetRow.columns.filter((_, idx) => idx !== columnIndex);
            form.setValue(`rows.${rowIndex}.columns`, updatedColumns, { shouldDirty: true });
        }
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
            await setDoc(settingsDocRef, dataToSave, { merge: true });
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
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveChanges)} className="space-y-8">
                <Card className="frosted-glass">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                             <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-primary" /> Agent Dashboard Layout</CardTitle>
                             <CardDescription>Add rows and columns, then place widgets to build the agent dashboard.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                             <Button variant="outline" type="button" onClick={handleAddNewRow} disabled={isSaving}>
                                <Rows className="mr-2 h-4 w-4" /> Add Row
                             </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="mr-2 h-4 w-4" />
                                {isSaving ? 'Saving...' : 'Save Layout'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {rowFields.length === 0 ? (
                            <div className="text-center py-10 border-2 border-dashed rounded-lg">
                                <p className="text-muted-foreground">No rows yet. Click "Add Row" to begin building the layout.</p>
                            </div>
                        ) : (
                            rowFields.map((row, rowIndex) => (
                                <RowEditor key={row.id} rowIndex={rowIndex} removeRow={removeRow} form={form} onAddColumn={handleAddNewColumn} onRemoveColumn={handleRemoveColumn} onAddWidget={handleAddWidgetToColumn} onRemoveWidget={handleRemoveWidgetFromColumn} />
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Sidebar Menu Settings Card */}
                <Card className="frosted-glass">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><View className="h-5 w-5 text-primary" /> Sidebar Menu Settings</CardTitle>
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
    );
}

// --- Sub-components for the Editor ---

interface RowEditorProps {
    rowIndex: number;
    removeRow: (index: number) => void;
    form: any;
    onAddColumn: (rowIndex: number) => void;
    onRemoveColumn: (rowIndex: number, colIndex: number) => void;
    onAddWidget: (rowIndex: number, colIndex: number, widgetType: WidgetType) => void;
    onRemoveWidget: (rowIndex: number, colIndex: number, widgetIndex: number) => void;
}

function RowEditor({ rowIndex, removeRow, form, onAddColumn, onRemoveColumn, onAddWidget, onRemoveWidget }: RowEditorProps) {
    const { fields: columnFields } = useFieldArray({ control: form.control, name: `rows.${rowIndex}.columns`, keyName: "colId" });

    return (
        <div className="p-4 border rounded-lg bg-background shadow-sm space-y-3">
             <div className="flex items-center justify-between">
                <Label className="font-medium text-muted-foreground">Row {rowIndex + 1}</Label>
                 <div className="flex items-center gap-2">
                     <Button variant="outline" size="sm" type="button" onClick={() => onAddColumn(rowIndex)}>
                        <Columns className="mr-2 h-4 w-4"/> Add Column
                     </Button>
                    <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeRow(rowIndex)}><Trash2 className="h-4 w-4"/></Button>
                </div>
            </div>
             <div className={cn("min-h-[8rem] p-4 border-2 border-dashed rounded-md flex items-start gap-4", columnFields.length === 0 && "justify-center items-center")}>
                 {columnFields.length === 0 ? (
                     <p className="text-sm text-muted-foreground">Add a column to this row.</p>
                 ) : (
                     columnFields.map((col, colIndex) => (
                         <ColumnEditor key={col.id} rowIndex={rowIndex} colIndex={colIndex} onRemoveColumn={onRemoveColumn} onAddWidget={onAddWidget} onRemoveWidget={onRemoveWidget} form={form} />
                     ))
                 )}
            </div>
        </div>
    );
}

interface ColumnEditorProps {
    rowIndex: number;
    colIndex: number;
    onRemoveColumn: (rowIndex: number, colIndex: number) => void;
    onAddWidget: (rowIndex: number, colIndex: number, widgetType: WidgetType) => void;
    onRemoveWidget: (rowIndex: number, colIndex: number, widgetIndex: number) => void;
    form: any;
}


function ColumnEditor({ rowIndex, colIndex, onRemoveColumn, onAddWidget, onRemoveWidget, form }: ColumnEditorProps) {
    const columnPath = `rows.${rowIndex}.columns.${colIndex}.widgets`;
    const { fields: widgetFields } = useFieldArray({ control: form.control, name: columnPath, keyName: "widgetId" });

    return (
        <div className="relative p-3 border rounded-md bg-card shadow-sm flex-1 min-w-[250px] flex flex-col gap-4 group">
            <Button onClick={() => onRemoveColumn(rowIndex, colIndex)} variant="ghost" size="icon" className="absolute -top-3 -right-3 h-6 w-6 text-destructive bg-card border rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-4 w-4"/></Button>

            <div className="space-y-3">
                {widgetFields.map((widget, widgetIndex) => (
                    <WidgetEditor key={widget.id} rowIndex={rowIndex} colIndex={colIndex} widgetIndex={widgetIndex} onRemoveWidget={onRemoveWidget} form={form} />
                ))}
            </div>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="mt-auto w-full">
                        <PlusCircle className="mr-2 h-4 w-4"/> Add Widget
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                     <DropdownMenuLabel>Available Widgets</DropdownMenuLabel>
                     <DropdownMenuSeparator />
                    {AVAILABLE_WIDGETS.map(w => (
                        <DropdownMenuItem key={w.id} onSelect={() => onAddWidget(rowIndex, colIndex, w.id)}>
                            {w.name}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

interface WidgetEditorProps {
    rowIndex: number;
    colIndex: number;
    widgetIndex: number;
    onRemoveWidget: (rowIndex: number, colIndex: number, widgetIndex: number) => void;
    form: any;
}

function WidgetEditor({ rowIndex, colIndex, widgetIndex, onRemoveWidget, form }: WidgetEditorProps) {
    const { control } = form;
    const widgetPath = `rows.${rowIndex}.columns.${colIndex}.widgets.${widgetIndex}`;
    const widget = form.watch(widgetPath);

    if (!widget) return null; // Should not happen if key exists

    return (
         <div className="relative p-2 border rounded-md bg-background/50 shadow-sm flex flex-col gap-2 group/widget">
             <div className="flex items-center justify-between">
                 <Label className="font-medium text-sm truncate">{widget.name}</Label>
                 <div className="flex items-center gap-1">
                     <FormField control={control} name={`${widgetPath}.isEnabled`} render={({ field }) => (<FormItem><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                     <Button onClick={() => onRemoveWidget(rowIndex, colIndex, widgetIndex)} variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"><Trash2 className="h-4 w-4"/></Button>
                 </div>
            </div>
             <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="settings" className="border-b-0">
                    <AccordionTrigger className="text-xs py-1">Settings</AccordionTrigger>
                    <AccordionContent className="pt-2 space-y-4">
                        {widget.type === 'motd' && (
                            <>
                                <FormField control={control} name={`${widgetPath}.emoji`} render={({ field }) => (<FormItem><FormLabel>Emoji</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`${widgetPath}.content`} render={({ field }) => (<FormItem><FormLabel>Content</FormLabel><FormControl><KpiQuestLexicalEditor initialHtml={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                            </>
                        )}
                        {widget.type === 'custom-html' && (
                            <>
                                <FormField control={control} name={`${widgetPath}.content`} render={({ field }) => (<FormItem><FormLabel>HTML Content</FormLabel><FormControl><KpiQuestLexicalEditor initialHtml={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                            </>
                        )}
                        {(widget.type && (widget.type === 'achievements' || widget.type === 'pod-targets' || widget.type.startsWith('leaderboard-'))) && (
                             <p className="text-sm text-muted-foreground">This widget has no additional settings.</p>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
         </div>
    );
}

