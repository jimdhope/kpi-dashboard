'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Use Textarea
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, setDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Loader2, Save, MessageCircle } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';

// Define the structure of the message in Firestore
interface MessageOfTheDayData {
  emoji: string;
  content: string; // Store as plain text or basic HTML if Textarea is used
  updatedAt: Timestamp;
  updatedBy: string; // UID of the admin who updated
}

// Zod schema for form validation
const messageFormSchema = z.object({
  emoji: z.string().min(1, { message: "Emoji is required." }).max(5, { message: "Emoji should be short." }), // Basic validation
  content: z.string().min(10, { message: "Message content must be at least 10 characters." }).max(1000, { message: "Message content must be 1000 characters or less." }),
});

type MessageFormData = z.infer<typeof messageFormSchema>;

const MESSAGE_DOC_ID = "currentMessage"; // Fixed document ID for the message
const MESSAGE_COLLECTION = "messageOfTheDay";

export default function MessageOfTheDayAdminPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);

  const form = useForm<MessageFormData>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: {
      emoji: '🎉',
      content: '',
    },
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUserUid(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  const fetchMessage = useCallback(async () => {
    setIsLoading(true);
    try {
      const messageDocRef = doc(db, MESSAGE_COLLECTION, MESSAGE_DOC_ID);
      const docSnap = await getDoc(messageDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as MessageOfTheDayData;
        form.reset({
          emoji: data.emoji || '🎉',
          content: data.content || '',
        });
      } else {
        // No message set yet, use defaults
        form.reset({ emoji: '🎉', content: '' });
      }
    } catch (error) {
      console.error("Error fetching message of the day:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load the current message." });
    } finally {
      setIsLoading(false);
    }
  }, [form, toast]);

  useEffect(() => {
    fetchMessage();
  }, [fetchMessage]);

  const onSubmit = async (data: MessageFormData) => {
    if (!currentUserUid) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in to save." });
      return;
    }
    setIsSaving(true);
    try {
      const messageDocRef = doc(db, MESSAGE_COLLECTION, MESSAGE_DOC_ID);
      const messageData: MessageOfTheDayData = {
        ...data,
        updatedAt: serverTimestamp() as Timestamp,
        updatedBy: currentUserUid,
      };
      await setDoc(messageDocRef, messageData);
      toast({ title: "Success", description: "Message of the Day has been updated." });
    } catch (error) {
      console.error("Error saving message of the day:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not save the message." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" /> Manage Message of the Day</CardTitle>
          <CardDescription>Create or update the message that will be displayed on agent dashboards.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-1/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-24" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="emoji"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emoji/Icon</FormLabel>
                      <FormControl>
                        <Input placeholder="🎉" {...field} className="w-20 text-2xl p-2 h-auto text-center" maxLength={5} />
                      </FormControl>
                      <FormDescription>Enter a single emoji or short icon text.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message Content</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter the message of the day here. You can use basic HTML for formatting like <b>bold</b> or <i>italic</i>."
                          {...field}
                          rows={8}
                          className="resize-y"
                        />
                      </FormControl>
                      <FormDescription>This message will be shown to all agents.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save Message'}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
