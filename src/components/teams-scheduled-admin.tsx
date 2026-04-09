"use client";

import { useState } from "react";
import { 
  TEAMS_AUTOMATION_DELIVERY_FORMATS,
  TEAMS_REPEAT_INTERVALS,
  TEAMS_AUTOMATION_MODE_LABELS,
  TEAMS_AUTOMATION_DELIVERY_FORMAT_LABELS,
  TeamsWebhookRecord, 
  TeamsMessageTemplateRecord,
  TeamsAutomationDeliveryFormat,
  TeamsAutomationRecord
} from "@/lib/contracts";
import { TeamsChannelSelect } from "@/components/teams-channel-select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Calendar, List, Plus, Pencil, Trash2, Clock, CalendarDays, Play, Pause } from "lucide-react";
import { format } from "date-fns";

interface TeamsScheduledAdminProps {
  webhooks: TeamsWebhookRecord[];
  templates: TeamsMessageTemplateRecord[];
  initialAutomations: TeamsAutomationRecord[];
}

interface ScheduledFormState {
  name: string;
  webhookId: string;
  templateId: string;
  deliveryFormat: TeamsAutomationDeliveryFormat;
  titleTemplate: string;
  messageTemplate: string;
  scheduleType: "oneTime" | "recurring";
  oneTimeAt: string;
  startsAt: string;
  endsAt: string;
  repeatEveryMinutes: number;
  timezone: string;
  isActive: boolean;
}

const emptyForm: ScheduledFormState = {
  name: "",
  webhookId: "",
  templateId: "",
  deliveryFormat: "adaptiveCard",
  titleTemplate: "",
  messageTemplate: "",
  scheduleType: "oneTime",
  oneTimeAt: "",
  startsAt: "",
  endsAt: "",
  repeatEveryMinutes: 1440,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  isActive: true,
};

export function TeamsScheduledAdmin({ 
  webhooks, 
  templates, 
  initialAutomations 
}: TeamsScheduledAdminProps) {
  const [automations, setAutomations] = useState(initialAutomations);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ScheduledFormState>(emptyForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter to only show scheduled automations (oneTime or recurring)
  const scheduledAutomations = automations.filter(
    (a) => a.mode === "oneTime" || a.mode === "recurring"
  );

  function startEdit(automation: TeamsAutomationRecord) {
    setEditingId(automation.id);
    setForm({
      name: automation.name,
      webhookId: automation.outgoingWebhookId,
      templateId: automation.messageTemplateId || "",
      deliveryFormat: automation.deliveryFormat,
      titleTemplate: automation.titleTemplate,
      messageTemplate: automation.messageTemplate,
      scheduleType: automation.mode === "oneTime" ? "oneTime" : "recurring",
      oneTimeAt: automation.oneTimeAt ? automation.oneTimeAt.slice(0, 16) : "",
      startsAt: automation.startsAt ? automation.startsAt.slice(0, 16) : "",
      endsAt: automation.endsAt ? automation.endsAt.slice(0, 16) : "",
      repeatEveryMinutes: automation.repeatEveryMinutes || 1440,
      timezone: automation.timezone || "UTC",
      isActive: automation.isActive,
    });
    setError(null);
    setShowModal(true);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowModal(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowModal(false);
  }

  async function handleSubmit() {
    setPending(true);
    setError(null);

    const payload = {
      name: form.name,
      trigger: "performanceLogged" as const,
      scope: "global" as const,
      mode: form.scheduleType === "oneTime" ? "oneTime" as const : "recurring" as const,
      deliveryFormat: form.deliveryFormat,
      outgoingWebhookId: form.webhookId,
      messageTemplateId: form.templateId || null,
      titleTemplate: form.titleTemplate,
      messageTemplate: form.messageTemplate,
      oneTimeAt: form.scheduleType === "oneTime" && form.oneTimeAt ? new Date(form.oneTimeAt).toISOString() : null,
      startsAt: form.scheduleType === "recurring" && form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.scheduleType === "recurring" && form.endsAt ? new Date(form.endsAt).toISOString() : null,
      timezone: form.timezone,
      repeatEveryMinutes: form.scheduleType === "recurring" ? form.repeatEveryMinutes : null,
      isActive: form.isActive,
    };

    try {
      const response = await fetch(
        editingId 
          ? `/api/integrations/teams-automations/${editingId}` 
          : "/api/integrations/teams-automations",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();
      setPending(false);

      if (!response.ok) {
        setError(result.error ?? "Failed to save scheduled post.");
        return;
      }

      if (editingId) {
        setAutomations((current) => current.map((a) => (a.id === result.id ? result : a)));
      } else {
        setAutomations((current) => [...current, result]);
      }

      resetForm();
    } catch (err) {
      setPending(false);
      setError("Failed to save scheduled post.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this scheduled post?")) return;
    
    setPending(true);
    const response = await fetch(`/api/integrations/teams-automations/${id}`, {
      method: "DELETE",
    });
    setPending(false);

    if (response.ok) {
      setAutomations((current) => current.filter((a) => a.id !== id));
    }
  }

  async function toggleActive(id: string, currentActive: boolean) {
    const automation = automations.find(a => a.id === id);
    if (!automation) return;

    const payload = {
      name: automation.name,
      trigger: automation.trigger,
      scope: automation.scope,
      mode: automation.mode,
      deliveryFormat: automation.deliveryFormat,
      outgoingWebhookId: automation.outgoingWebhookId,
      messageTemplateId: automation.messageTemplateId,
      titleTemplate: automation.titleTemplate,
      messageTemplate: automation.messageTemplate,
      oneTimeAt: automation.oneTimeAt,
      startsAt: automation.startsAt,
      endsAt: automation.endsAt,
      timezone: automation.timezone,
      repeatEveryMinutes: automation.repeatEveryMinutes,
      isActive: !currentActive,
    };

    const response = await fetch(`/api/integrations/teams-automations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();
      setAutomations((current) => current.map((a) => (a.id === id ? result : a)));
    }
  }

  // Handle template selection
  const selectedTemplate = templates.find(t => t.id === form.templateId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Scheduled Posts</CardTitle>
          <CardDescription>
            Schedule messages to be sent to Teams channels.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "calendar")}>
            <TabsList>
              <TabsTrigger value="list">
                <List className="w-4 h-4 mr-1" />
                List
              </TabsTrigger>
              <TabsTrigger value="calendar">
                <CalendarDays className="w-4 h-4 mr-1" />
                Calendar
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={startCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Scheduled Post
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {scheduledAutomations.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No scheduled posts yet"
            description="Create a scheduled post to send messages to Teams channels automatically."
            action={{
              label: "Create Scheduled Post",
              onClick: startCreate,
            }}
          />
        ) : viewMode === "list" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scheduledAutomations.map((automation) => (
                <TableRow key={automation.id}>
                  <TableCell>
                    <div className="font-medium">{automation.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {automation.titleTemplate}
                    </div>
                  </TableCell>
                  <TableCell>
                    {automation.outgoingWebhookName}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="w-3 h-3" />
                      {automation.mode === "oneTime" && automation.oneTimeAt
                        ? format(new Date(automation.oneTimeAt), "PPp")
                        : automation.mode === "recurring"
                        ? `${TEAMS_REPEAT_INTERVALS.find(r => r.value === automation.repeatEveryMinutes)?.label || `Every ${automation.repeatEveryMinutes} min`}`
                        : "Event-based"
                      }
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={automation.isActive ? "active" : "inactive"} size="sm" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActive(automation.id, automation.isActive)}
                      >
                        {automation.isActive ? (
                          <><Pause className="mr-1 h-3 w-3" /> Pause</>
                        ) : (
                          <><Play className="mr-1 h-3 w-3" /> Activate</>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(automation)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(automation.id)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Calendar view coming soon</p>
            <p className="text-sm">Switch to List view to manage scheduled posts</p>
          </div>
        )}
      </CardContent>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Scheduled Post" : "Create New Scheduled Post"}</DialogTitle>
            <DialogDescription>
              Schedule a message to be sent to a Teams channel.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                placeholder="e.g., Daily Summary"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="webhook">Teams Channel</Label>
              <TeamsChannelSelect
                webhooks={webhooks}
                value={form.webhookId}
                onValueChange={(value) => setForm((current) => ({ ...current, webhookId: value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template">Template (optional)</Label>
              <Select
                value={form.templateId || "__custom__"}
                onValueChange={(value) => {
                  if (value === "__custom__") {
                    setForm((current) => ({ ...current, templateId: "" }));
                    return;
                  }
                  const template = templates.find(t => t.id === value);
                  setForm((current) => ({
                    ...current,
                    templateId: value,
                    titleTemplate: template?.titleTemplate || current.titleTemplate,
                    messageTemplate: template?.messageTemplate || current.messageTemplate,
                    deliveryFormat: template?.deliveryFormat || current.deliveryFormat,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__custom__">Custom message</SelectItem>
                  {templates.filter(t => t.isActive).map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="titleTemplate">Title</Label>
                <Input
                  id="titleTemplate"
                  required
                  value={form.titleTemplate}
                  onChange={(e) => setForm((current) => ({ ...current, titleTemplate: e.target.value }))}
                  placeholder="Daily Performance Update"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="deliveryFormat">Format</Label>
                <Select
                  value={form.deliveryFormat}
                  onValueChange={(value) => setForm((current) => ({ ...current, deliveryFormat: value as TeamsAutomationDeliveryFormat }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAMS_AUTOMATION_DELIVERY_FORMATS.map((format) => (
                      <SelectItem key={format} value={format}>
                        {TEAMS_AUTOMATION_DELIVERY_FORMAT_LABELS[format]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="messageTemplate">Message</Label>
              <Textarea
                id="messageTemplate"
                required
                rows={3}
                value={form.messageTemplate}
                onChange={(e) => setForm((current) => ({ ...current, messageTemplate: e.target.value }))}
                placeholder="Your message content..."
              />
            </div>

            <div className="grid gap-2">
              <Label>Schedule</Label>
              <Select
                value={form.scheduleType}
                onValueChange={(value) => setForm((current) => ({ ...current, scheduleType: value as "oneTime" | "recurring" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oneTime">{TEAMS_AUTOMATION_MODE_LABELS.oneTime}</SelectItem>
                  <SelectItem value="recurring">{TEAMS_AUTOMATION_MODE_LABELS.recurring}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.scheduleType === "oneTime" ? (
              <div className="grid gap-2">
                <Label htmlFor="oneTimeAt">Send Date & Time</Label>
                <Input
                  id="oneTimeAt"
                  type="datetime-local"
                  required
                  value={form.oneTimeAt}
                  onChange={(e) => setForm((current) => ({ ...current, oneTimeAt: e.target.value }))}
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startsAt">Start Date</Label>
                    <Input
                      id="startsAt"
                      type="datetime-local"
                      required
                      value={form.startsAt}
                      onChange={(e) => setForm((current) => ({ ...current, startsAt: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="endsAt">End Date (optional)</Label>
                    <Input
                      id="endsAt"
                      type="datetime-local"
                      value={form.endsAt}
                      onChange={(e) => setForm((current) => ({ ...current, endsAt: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="repeatEveryMinutes">Repeat Every</Label>
                  <Select
                    value={String(form.repeatEveryMinutes)}
                    onValueChange={(value) => setForm((current) => ({ ...current, repeatEveryMinutes: Number(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAMS_REPEAT_INTERVALS.map((interval) => (
                        <SelectItem key={interval.value} value={String(interval.value)}>
                          {interval.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>

            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending ? "Saving..." : editingId ? "Update Scheduled Post" : "Create Scheduled Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
