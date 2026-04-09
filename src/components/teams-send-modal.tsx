"use client";

import { useState, useEffect } from "react";
import { TeamsWebhookRecord, TeamsMessageTemplateRecord, TeamsChannelCategory } from "@/lib/contracts";
import { TeamsChannelSelect } from "@/components/teams-channel-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TeamsSendModalProps {
  webhooks: TeamsWebhookRecord[];
  templates: TeamsMessageTemplateRecord[];
  defaultCategory?: TeamsChannelCategory;
  trigger?: React.ReactNode;
  onSend?: () => void;
}

export function TeamsSendModal({
  webhooks,
  templates,
  defaultCategory,
  trigger,
  onSend,
}: TeamsSendModalProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [channelId, setChannelId] = useState("");
  const [mode, setMode] = useState<"template" | "custom">("template");
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setChannelId("");
      setMode("template");
      setTemplateId("");
      setTitle("");
      setMessage("");
      setSuccess(false);
      setError(null);
    }
  }, [open]);

  // Filter templates by category
  const filteredTemplates = defaultCategory
    ? templates.filter((t) => t.category === defaultCategory && t.isActive)
    : templates.filter((t) => t.isActive);

  // Handle template selection
  const selectedTemplate = templates.find((t) => t.id === templateId);

  async function handleSend() {
    if (!channelId || (!templateId && !title)) {
      setError("Please fill in all required fields.");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/integrations/teams/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookId: channelId,
          templateId: mode === "template" ? templateId : null,
          title: mode === "custom" ? title : undefined,
          message: mode === "custom" ? message : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send message");
      }

      setSuccess(true);
      onSend?.();
      
      // Close modal after brief delay
      setTimeout(() => {
        setOpen(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            Send to Teams
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send to Teams</DialogTitle>
          <DialogDescription>
            Send a message to a Teams channel using a template or custom message.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Channel Selection */}
          <div className="grid gap-2">
            <Label htmlFor="channel">Teams Channel</Label>
            <TeamsChannelSelect
              webhooks={webhooks}
              value={channelId}
              onValueChange={setChannelId}
              category={defaultCategory}
              placeholder="Select a channel"
            />
          </div>

          {/* Mode Selection */}
          <div className="grid gap-2">
            <Label>Message Type</Label>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "template" | "custom")}>
              <TabsList className="w-full">
                <TabsTrigger value="template" className="flex-1">
                  Template
                </TabsTrigger>
                <TabsTrigger value="custom" className="flex-1">
                  Custom
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Template Mode */}
          {mode === "template" && (
            <div className="grid gap-2">
              <Label htmlFor="template">Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTemplates.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No templates available
                    </div>
                  ) : (
                    filteredTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex flex-col">
                          <span>{template.name}</span>
                          {template.category && (
                            <span className="text-xs text-muted-foreground">
                              {template.category.replace("_", " ")}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              
              {selectedTemplate && (
                <div className="mt-2 p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium">Preview:</p>
                  <p className="text-muted-foreground mt-1">
                    <span className="font-semibold">Title:</span> {selectedTemplate.titleTemplate}
                  </p>
                  <p className="text-muted-foreground mt-1 truncate">
                    <span className="font-semibold">Message:</span> {selectedTemplate.messageTemplate}
                  </p>
                  {selectedTemplate.facts.length > 0 && (
                    <p className="text-muted-foreground mt-1">
                      <span className="font-semibold">Facts:</span>{" "}
                      {selectedTemplate.facts.map((f) => f.name).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Custom Mode */}
          {mode === "custom" && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Daily Performance Update"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your message..."
                  rows={4}
                />
              </div>
            </>
          )}

          {error && (
            <div className="text-sm font-medium text-destructive">{error}</div>
          )}

          {success && (
            <div className="text-sm font-medium text-green-600">
              Message sent successfully!
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !channelId || (mode === "template" ? !templateId : !title)}
          >
            {sending ? "Sending..." : "Send to Teams"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
