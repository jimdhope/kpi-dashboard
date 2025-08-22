
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
import { Loader2, Save, Settings, MessageCircle, BarChart, Trophy, Link as LinkIcon, Trash2, PlusCircle, AlertCircle } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from "@/components/ui/switch";
import { Input } from '@/components/ui/input';
import { KpiQuestLexicalEditor } from '@/components/LexicalEditor';

// --- Zod Schema Definitions ---
const externalLinkSchema = z.object({
    id: z.string().optional(),
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
  // Widget visibility settings
  widgets: z.object({
    showAchievements: z.boolean(),
    showPodTargets: z.boolean(),
    showLeaderboards: z.boolean(),
  }),
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

// Type for data stored in Firestore
export interface DashboardSettingsData extends DashboardSettingsFormData {
  updatedAt: Timestamp;
  updatedBy: string;
}

const SETTINGS_DOC_ID = "agentDashboardSettings";
const SETTINGS_COLLECTION = "settings";

export default function AgentDashboardSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);

  const form = useForm<DashboardSettingsFormData>({
    resolver: zodResolver(dashboardSettingsSchema),
    defaultValues: {
      motd: { isEnabled: true, emoji: '🎉', content: '<p><br></p>' },
      widgets: { showAchievements: true, showPodTargets: true, showLeaderboards: true },
      sidebar: { showRpsGame: true, showAgentGuide: true, showAdminGuide: false },
      externalLinks: { isEnabled: false, links: [] },
    },
  });

   const { fields, append, remove } = useFieldArray({
     control: form.control,
     name: "externalLinks.links",
   });

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
        form.reset(data); // Populate form with fetched data
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
      append({ id: `new-${Date.now()}`, title: '', url: '' });
  };

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
        
        {/* --- Main Settings Card --- */}
        <Card className="frosted-glass">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-primary" /> Agent Dashboard Settings</CardTitle>
                <CardDescription>Control the components and links that appear on the agent dashboard.</CardDescription>
            </CardHeader>
        </Card>

        {/* --- Dashboard Widgets Card --- */}
        <Card className="frosted-glass">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><BarChart className="h-5 w-5"/> Dashboard Widgets</CardTitle>
            <CardDescription>Choose which info cards are visible on the main agent dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
              <FormField control={form.control} name="widgets.showAchievements" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-card/50"><div className="space-y-0.5"><FormLabel>Today's Achievements</FormLabel><FormDescription>Allows agents to log their daily KPIs.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
              )}/>
              <FormField control={form.control} name="widgets.showPodTargets" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-card/50"><div className="space-y-0.5"><FormLabel>Pod Targets</FormLabel><FormDescription>Shows the pod's collective progress towards its goals.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
              )}/>
              <FormField control={form.control} name="widgets.showLeaderboards" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-card/50"><div className="space-y-0.5"><FormLabel>Leaderboards</FormLabel><FormDescription>Displays agent and team rankings for the competition.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
              )}/>
          </CardContent>
        </Card>

        {/* --- Message of the Day Card --- */}
        <Card className="frosted-glass">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><MessageCircle className="h-5 w-5"/> Message of the Day</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                 <FormField control={form.control} name="motd.isEnabled" render={({ field }) => (
                     <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-card/50"><div className="space-y-0.5"><FormLabel>Enable Message of the Day</FormLabel><FormDescription>Show or hide this widget on the dashboard.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                 )}/>
                <FormField control={form.control} name="motd.emoji" render={({ field }) => (
                    <FormItem><FormLabel>Emoji</FormLabel><FormControl><Input {...field} className="max-w-xs" disabled={!form.watch('motd.isEnabled')} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="motd.content" render={({ field }) => (
                    <FormItem><FormLabel>Content</FormLabel><FormControl><KpiQuestLexicalEditor initialHtml={field.value} onChange={field.onChange} editable={form.watch('motd.isEnabled')} /></FormControl><FormMessage /></FormItem>
                )}/>
            </CardContent>
        </Card>

         {/* --- External Links Card --- */}
        <Card className="frosted-glass">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><LinkIcon className="h-5 w-5"/> External Links</CardTitle>
                <CardDescription>Provide quick access to important external websites or resources in the agent sidebar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <FormField control={form.control} name="externalLinks.isEnabled" render={({ field }) => (
                     <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-card/50"><div className="space-y-0.5"><FormLabel>Enable External Links Section</FormLabel><FormDescription>Show or hide this section in the agent sidebar.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                 )}/>
                 {form.watch('externalLinks.isEnabled') && (
                     <div className="space-y-4">
                        {fields.length === 0 && (
                             <div className="text-center text-muted-foreground py-4 border-dashed border-2 rounded-md">
                                 <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2"/>
                                 <p>No links added yet. Click below to add one.</p>
                             </div>
                        )}
                         {fields.map((field, index) => (
                             <div key={field.id} className="flex items-end gap-2 border p-3 rounded-md bg-card/30">
                                 <FormField control={form.control} name={`externalLinks.links.${index}.title`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Title</FormLabel><FormControl><Input {...field} placeholder="e.g., Company SharePoint" /></FormControl><FormMessage /></FormItem>)} />
                                 <FormField control={form.control} name={`externalLinks.links.${index}.url`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>URL</FormLabel><FormControl><Input {...field} placeholder="https://..." /></FormControl><FormMessage /></FormItem>)} />
                                 <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>
                             </div>
                         ))}
                         <Button type="button" variant="outline" size="sm" onClick={addNewLink}><PlusCircle className="mr-2 h-4 w-4"/>Add Link</Button>
                     </div>
                 )}
            </CardContent>
        </Card>

        {/* --- Save Button --- */}
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
