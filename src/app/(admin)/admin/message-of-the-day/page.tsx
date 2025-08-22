

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, setDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Loader2, Save, Settings, PlusCircle, Trash2, Rows, View, Columns, X, ArrowLeft, ArrowRight } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


// --- Zod Schema Definitions ---

export type WidgetType =
    | 'motd'
    | 'achievements'
    | 'pod-targets'
    | 'leaderboard-agent'
    | 'leaderboard-team'
    | 'leaderboard-pod'
    | 'custom-html'
    | 'log-achievements'; // Added new widget type

const baseWidgetSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  isEnabled: z.boolean(),
});

const motdWidgetSchema = baseWidgetSchema.extend({
  type: z.literal('motd'),
  title: z.string().min(1, 'Title is required.').optional().or(z.literal('')),
  emoji: z.string().max(10, 'Emoji should be short.').optional().or(z.literal('')),
  content: z.string().min(1, 'Message content is required.'),
});

const customHtmlWidgetSchema = baseWidgetSchema.extend({
  type: z.literal('custom-html'),
  content: z.string().min(1, 'HTML content is required.'),
});

const standardWidgetSchema = baseWidgetSchema.extend({
    type: z.enum(['achievements', 'pod-targets', 'leaderboard-agent', 'leaderboard-team', 'leaderboard-pod', 'log-achievements']),
});

const specificWidgetSchema = z.discriminatedUnion('type', [
    motdWidgetSchema,
    customHtmlWidgetSchema,
    standardWidgetSchema,
]);

export type SpecificWidget = z.infer<typeof specificWidgetSchema>;

const columnSchema = z.object({
    id: z.string(),
    width: z.number().min(10).max(100), // Width as a percentage
    name: z.string().optional(), // Optional column name/title
    showName: z.boolean().optional(), // Option to show the name on the dashboard
    widgets: z.array(specificWidgetSchema),
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
    { id: 'log-achievements', name: 'Log Achievements' }, // Added new widget
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
                return { ...base, type: 'motd', name: 'Message of the Day', title: 'Message of the Day', emoji: '🎉', content: '<p>Welcome!</p>' };
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
            case 'log-achievements':
                return { ...base, type: 'log-achievements', name: 'Log Achievements' };
            case 'custom-html':
                 return { ...base, type: 'custom-html', name: 'Custom HTML', content: '<p>Your custom content here.</p>' };
            default:
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
        appendRow({ id: `row-${Date.now()}`, columns: [{ id: `col-${Date.now()}`, width: 100, widgets: [], name: '', showName: false }] });
    };

    const rebalanceColumnWidths = (columns: Column[]): Column[] => {
        const totalWidth = 100;
        const count = columns.length;
        if (count === 0) return [];
        const equalWidth = totalWidth / count;
        return columns.map(col => ({ ...col, width: equalWidth }));
    };

    const handleAddNewColumn = (rowIndex: number) => {
        const rows = form.getValues('rows');
        const targetRow = rows[rowIndex];
        if (targetRow) {
            const newColumn: Column = { id: `col-${Date.now()}`, width: 0, widgets: [], name: '', showName: false };
            const updatedColumns = [...targetRow.columns, newColumn];
            const rebalancedColumns = rebalanceColumnWidths(updatedColumns);
            form.setValue(`rows.${rowIndex}.columns`, rebalancedColumns, { shouldDirty: true });
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
            let updatedColumns = targetRow.columns.filter((_, idx) => idx !== columnIndex);
            updatedColumns = rebalanceColumnWidths(updatedColumns);
            form.setValue(`rows.${rowIndex}.columns`, updatedColumns, { shouldDirty: true });
        }
    };

    const handleMoveColumn = (rowIndex: number, colIndex: number, direction: 'left' | 'right') => {
        const rows = form.getValues('rows');
        const targetRow = rows[rowIndex];
        if (!targetRow) return;

        const columns = [...targetRow.columns];
        const targetColumn = columns[colIndex];
        const swapIndex = direction === 'left' ? colIndex - 1 : colIndex + 1;

        if (swapIndex < 0 || swapIndex >= columns.length) return; // Out of bounds

        // Simple swap
        columns[colIndex] = columns[swapIndex];
        columns[swapIndex] = targetColumn;

        form.setValue(`rows.${rowIndex}.columns`, columns, { shouldDirty: true });
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
                                <RowEditor key={row.id} rowIndex={rowIndex} removeRow={removeRow} form={form} onAddColumn={handleAddNewColumn} onRemoveColumn={handleRemoveColumn} onAddWidget={handleAddWidgetToColumn} onRemoveWidget={handleRemoveWidgetFromColumn} onMoveColumn={handleMoveColumn} />
                            ))
                        )}
                    </CardContent>
                </Card>

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
    onMoveColumn: (rowIndex: number, colIndex: number, direction: 'left' | 'right') => void;
}

function RowEditor({ rowIndex, removeRow, form, onAddColumn, onRemoveColumn, onAddWidget, onRemoveWidget, onMoveColumn }: RowEditorProps) {
    const { control, setValue, getValues } = form;
    const { fields: columnFields } = useFieldArray({ control, name: `rows.${rowIndex}.columns`, keyName: "colId" });
    const rowRef = useRef<HTMLDivElement>(null);

    const handleResize = (dividerIndex: number, event: React.PointerEvent<HTMLDivElement>) => {
        const startX = event.clientX;
        const rowWidth = rowRef.current?.offsetWidth || 0;
        const initialColumns = getValues(`rows.${rowIndex}.columns`);
        const leftColInitialWidth = initialColumns[dividerIndex].width;
        const rightColInitialWidth = initialColumns[dividerIndex + 1].width;
        const combinedWidth = leftColInitialWidth + rightColInitialWidth;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const dx = moveEvent.clientX - startX;
            const widthChangePercent = (dx / rowWidth) * 100;
            
            let newLeftWidth = leftColInitialWidth + widthChangePercent;
            let newRightWidth = rightColInitialWidth - widthChangePercent;

            if (newLeftWidth < 10) {
                newLeftWidth = 10;
                newRightWidth = combinedWidth - 10;
            }
            if (newRightWidth < 10) {
                newRightWidth = 10;
                newLeftWidth = combinedWidth - 10;
            }

            const newColumns = [...initialColumns];
            newColumns[dividerIndex].width = newLeftWidth;
            newColumns[dividerIndex + 1].width = newRightWidth;
            setValue(`rows.${rowIndex}.columns`, newColumns, { shouldDirty: true });
        };

        const handlePointerUp = () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
        };

        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
    };

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
             <div ref={rowRef} className={cn("min-h-[8rem] p-4 border-2 border-dashed rounded-md flex items-stretch gap-0", columnFields.length === 0 && "justify-center items-center")}>
                 {columnFields.length === 0 ? (
                     <p className="text-sm text-muted-foreground">Add a column to this row.</p>
                 ) : (
                     columnFields.map((col, colIndex) => (
                        <React.Fragment key={col.id}>
                             <ColumnEditor
                                 key={col.id}
                                 rowIndex={rowIndex}
                                 colIndex={colIndex}
                                 onRemoveColumn={onRemoveColumn}
                                 onAddWidget={onAddWidget}
                                 onRemoveWidget={onRemoveWidget}
                                 onMoveColumn={onMoveColumn}
                                 form={form}
                                 width={col.width}
                                 isFirst={colIndex === 0}
                                 isLast={colIndex === columnFields.length - 1}
                             />
                              {colIndex < columnFields.length - 1 && (
                                <div
                                    onPointerDown={(e) => handleResize(colIndex, e)}
                                    className="w-2 h-auto cursor-col-resize flex items-center justify-center group bg-transparent"
                                >
                                    <div className="w-0.5 h-1/2 bg-border group-hover:bg-primary transition-colors"></div>
                                </div>
                            )}
                        </React.Fragment>
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
    onMoveColumn: (rowIndex: number, colIndex: number, direction: 'left' | 'right') => void;
    form: any;
    width: number;
    isFirst: boolean;
    isLast: boolean;
}


function ColumnEditor({ rowIndex, colIndex, onRemoveColumn, onAddWidget, onRemoveWidget, onMoveColumn, form, width, isFirst, isLast }: ColumnEditorProps) {
    const columnPath = `rows.${rowIndex}.columns.${colIndex}`;
    const { fields: widgetFields } = useFieldArray({ control: form.control, name: `${columnPath}.widgets`, keyName: "widgetId" });

    return (
        <div style={{ flexBasis: `${width}%` }} className="relative p-1 border rounded-md bg-card shadow-sm flex flex-col gap-4 group min-w-[200px]">
             {/* Column Header */}
            <div className="flex items-center justify-end h-8 px-2 border-b bg-muted/30">
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Column Settings">
                            <Settings className="h-4 w-4"/>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-4 space-y-4">
                        <FormField
                            control={form.control}
                            name={`${columnPath}.name`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Column Title (Optional)</FormLabel>
                                    <FormControl><Input placeholder="e.g., Leaderboards" {...field} /></FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`${columnPath}.showName`}
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                     <FormLabel>Show Title</FormLabel>
                                     <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                </FormItem>
                            )}
                        />
                    </PopoverContent>
                </Popover>

                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onMoveColumn(rowIndex, colIndex, 'left')} disabled={isFirst} title="Move Left">
                    <ArrowLeft className="h-4 w-4"/>
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onMoveColumn(rowIndex, colIndex, 'right')} disabled={isLast} title="Move Right">
                    <ArrowRight className="h-4 w-4"/>
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onRemoveColumn(rowIndex, colIndex)} title="Delete Column">
                    <Trash2 className="h-4 w-4"/>
                </Button>
            </div>

            <div className="space-y-3 p-2 flex-grow">
                {widgetFields.map((widget, widgetIndex) => (
                    <WidgetEditor key={widget.id} rowIndex={rowIndex} colIndex={colIndex} widgetIndex={widgetIndex} onRemoveWidget={onRemoveWidget} form={form} />
                ))}
            </div>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="mt-auto w-full mx-2 mb-2 self-center" style={{maxWidth: 'calc(100% - 1rem)'}}>
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
    const widget: SpecificWidget | undefined = form.watch(widgetPath);

    if (!widget) return null;

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
                                <FormField control={control} name={`${widgetPath}.title`} render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`${widgetPath}.emoji`} render={({ field }) => (<FormItem><FormLabel>Emoji</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`${widgetPath}.content`} render={({ field }) => (<FormItem><FormLabel>Content</FormLabel><FormControl><KpiQuestLexicalEditor initialHtml={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                            </>
                        )}
                        {widget.type === 'custom-html' && (
                            <>
                                <FormField control={control} name={`${widgetPath}.content`} render={({ field }) => (<FormItem><FormLabel>HTML Content</FormLabel><FormControl><KpiQuestLexicalEditor initialHtml={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                            </>
                        )}
                        {(widget.type && widget.type !== 'motd' && widget.type !== 'custom-html') && (
                             <p className="text-sm text-muted-foreground">This widget has no additional settings.</p>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
         </div>
    );
}

