
'use client';

import React, 'useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Trash2, PlusCircle, Loader2, Save, ListTodo } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

// Define the structure of a single daily task rule
const dailyTaskSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: 'Task name is required.' }).max(50, { message: 'Name max 50 chars.' }),
  emoji: z.string().optional(),
});

// Define the schema for the entire form (an array of tasks)
const dailyTasksFormSchema = z.object({
  tasks: z.array(dailyTaskSchema),
});

export type DailyTask = z.infer<typeof dailyTaskSchema>;
type DailyTasksFormData = z.infer<typeof dailyTasksFormSchema>;

const TASKS_COLLECTION = 'companyTasks';
const TASKS_DOC_ID = 'global';

export default function DailyTasksPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<DailyTasksFormData>({
    resolver: zodResolver(dailyTasksFormSchema),
    defaultValues: {
      tasks: [],
    },
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'tasks',
  });

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const tasksDocRef = doc(db, TASKS_COLLECTION, TASKS_DOC_ID);
      const tasksDocSnap = await getDoc(tasksDocRef);

      if (tasksDocSnap.exists()) {
        const data = tasksDocSnap.data();
        const existingTasks = data?.tasks || [];
        const tasksWithIds = existingTasks.map((task: any, index: number) => ({
          ...task,
          id: task.id || `temp-${index}`,
        }));
        form.reset({ tasks: tasksWithIds });
      } else {
        form.reset({ tasks: [] });
      }
    } catch (error) {
      console.error("Error fetching daily tasks:", error);
      toast({
        variant: "destructive",
        title: "Error Loading Tasks",
        description: "Could not load the company-wide daily tasks.",
      });
      form.reset({ tasks: [] });
    } finally {
      setIsLoading(false);
    }
  }, [form, toast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = () => {
    append({ id: `new-${Date.now()}`, name: '', emoji: '✅' });
  };

  const onSubmit = async (data: DailyTasksFormData) => {
    setIsSaving(true);
    try {
      const tasksDocRef = doc(db, TASKS_COLLECTION, TASKS_DOC_ID);
      const tasksToSave = data.tasks.map(task => ({
        id: task.id?.startsWith('new-') ? doc(collection(db, TASKS_COLLECTION)).id : task.id || doc(collection(db, TASKS_COLLECTION)).id,
        name: task.name,
        emoji: task.emoji || '✅',
      }));

      await setDoc(tasksDocRef, { tasks: tasksToSave }, { merge: true });
      toast({
        title: "Tasks Updated",
        description: `Company-wide daily tasks have been saved.`,
      });
      // Re-fetch to get the new server-generated IDs
      fetchTasks();
    } catch (error) {
      console.error("Error saving daily tasks:", error);
      toast({
        variant: "destructive",
        title: "Error Saving Tasks",
        description: "Could not save the daily tasks.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ListTodo /> Manage Daily Tasks</CardTitle>
          <CardDescription>
            Define simple, non-point-based tasks that agents should complete once per day (e.g., training, checks). These will appear as checkboxes on logging pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <ScrollArea className="max-h-[60vh] p-1 pr-4 mb-4">
                {isLoading ? (
                  <div className="space-y-4 p-4">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <div key={index} className="flex items-center gap-2 border p-3 rounded-md">
                        <Skeleton className="h-8 w-12" />
                        <Skeleton className="h-8 flex-1" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    ))}
                  </div>
                ) : fields.length === 0 ? (
                  <div className="text-center text-muted-foreground py-6">
                    No daily tasks defined yet. Click "Add Task" to start.
                  </div>
                ) : (
                  <div className="space-y-4 p-4">
                    <div className="flex items-end gap-2 px-3 pb-1 text-xs font-medium text-muted-foreground">
                      <Label className="w-12 text-left">Emoji</Label>
                      <Label className="flex-1 text-left">Task Name</Label>
                      <div className="w-8" /> {/* Spacer */}
                    </div>
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex items-start gap-2 border p-3 rounded-md bg-card">
                        <FormField
                          control={form.control}
                          name={`tasks.${index}.emoji`}
                          render={({ field }) => (
                            <FormItem className="w-12">
                              <FormLabel className="sr-only">Emoji</FormLabel>
                              <FormControl><Input placeholder="✅" {...field} maxLength={4} disabled={isSaving} className="text-center" /></FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`tasks.${index}.name`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel className="sr-only">Task Name</FormLabel>
                              <FormControl><Input placeholder="Task Name (e.g., AI Training)" {...field} disabled={isSaving} /></FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 mt-1"
                          onClick={() => remove(index)}
                          disabled={isSaving}
                          aria-label="Remove task"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-start mb-6 px-4">
                  <Button type="button" variant="outline" onClick={addTask} disabled={isSaving}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Task
                  </Button>
                </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 mt-auto pt-4 border-t">
                <Button type="submit" disabled={isSaving || isLoading}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                  {isSaving ? 'Saving...' : 'Save All Tasks'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
