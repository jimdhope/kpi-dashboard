'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, setDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Loader2, Save, MessageCircle, Smile } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import EmojiPicker, { type EmojiClickData, EmojiStyle } from 'emoji-picker-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch"; // Import Switch component

// Define the structure of the message in Firestore
interface MessageOfTheDayData {
  emoji: string;
  content: string;
  isEnabled: boolean; // Added isEnabled field
  updatedAt: Timestamp;
  updatedBy: string;
}

// Zod schema for form validation
const messageFormSchema = z.object({
  emoji: z.string().min(1, { message: "Emoji is required." }).max(10, { message: "Emoji should be short." }),
  content: z.string().min(10, { message: "Message content must be at least 10 characters." }).max(1000, { message: "Message content must be 1000 characters or less." }),
  isEnabled: z.boolean(), // Added isEnabled to schema
});

type MessageFormData = z.infer<typeof messageFormSchema>;

const MESSAGE_DOC_ID = "currentMessage";
const MESSAGE_COLLECTION = "messageOfTheDay";

export default function MessageOfTheDayAdminPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const form = useForm<MessageFormData>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: {
      emoji: '🎉',
      content: '',
      isEnabled: true, // Default to enabled
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
          isEnabled: data.isEnabled === undefined ? true : data.isEnabled, // Handle undefined case, default to true
        });
      } else {
        form.reset({ emoji: '🎉', content: '', isEnabled: true });
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

  const onEmojiClick = (emojiData: EmojiClickData) => {
    form.setValue('emoji', emojiData.emoji);
    setIsEmojiPickerOpen(false); // Close picker after selection
  };

  const currentEmoji = form.watch('emoji');

  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" /> Manage Message of the Day</CardTitle>
          <CardDescription>Create or update the message that will be displayed on agent dashboards. Basic HTML formatting is supported for the content.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-20" /> {/* For isEnabled label */}
              <Skeleton className="h-10 w-12" /> {/* For Switch */}
              <Skeleton className="h-10 w-1/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-24" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="isEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-card/50">
                      <div className="space-y-0.5">
                        <FormLabel>Enable Message</FormLabel>
                        <FormDescription>
                          Turn this on to display the message on agent dashboards.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={form.formState.isSubmitting}
                          aria-label="Enable or disable the message of the day"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emoji"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emoji/Icon</FormLabel>
                      <Popover open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-auto text-2xl p-2 h-auto text-center"
                            disabled={form.formState.isSubmitting || !form.getValues('isEnabled')}
                          >
                            {currentEmoji || <Smile className="h-6 w-6 text-muted-foreground" />}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-0 shadow-lg">
                          <EmojiPicker
                            onEmojiClick={onEmojiClick}
                            autoFocusSearch={false}
                            emojiStyle={EmojiStyle.NATIVE}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>Click to select an emoji.</FormDescription>
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
                          placeholder="Enter the message of the day here. You can use basic HTML for formatting like <b>bold</b> or <i>italic</i>. For more advanced formatting, consider using a dedicated rich text editor."
                          {...field}
                          rows={8}
                          className="resize-y"
                          disabled={form.formState.isSubmitting || !form.getValues('isEnabled')}
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