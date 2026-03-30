"use client";

import { useState } from "react";
import {
  AppCampaign,
  AppPod,
  TEAMS_AUTOMATION_MODES,
  TEAMS_AUTOMATION_SCOPES,
  TEAMS_AUTOMATION_TRIGGERS,
  TEAMS_AUTOMATION_CONDITION_METRICS,
  TEAMS_AUTOMATION_DELIVERY_FORMATS,
  TEAMS_AUTOMATION_TRIGGER_LABELS,
  TEAMS_AUTOMATION_SCOPE_LABELS,
  TEAMS_AUTOMATION_MODE_LABELS,
  TEAMS_AUTOMATION_CONDITION_METRIC_LABELS,
  TEAMS_AUTOMATION_DELIVERY_FORMAT_LABELS,
  TEAMS_REPEAT_INTERVALS,
  TEAMS_ACTIVITY_INTERVALS,
  TeamsAutomationConditionMetric,
  TeamsAutomationDeliveryFormat,
  TeamsAutomationMode,
  TeamsAutomationRecord,
  TeamsAutomationScope,
  TeamsAutomationTrigger,
  TeamsMessageTemplateRecord,
  TeamsWebhookRecord,
  TeamsIncomingEventRecord,
  DashboardLeaderboard,
  TeamStandingsData,
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
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import { VariablePills } from "@/components/variable-pills";
import { Plus, Pencil, Trash2, Zap, ArrowRight, Clock, Shield, Play, Pause } from "lucide-react";
import { format } from "date-fns";

interface TeamsAutomationAdminProps {
  initialAutomations: TeamsAutomationRecord[];
  recentEvents: TeamsIncomingEventRecord[];
  campaigns: AppCampaign[];
  pods: AppPod[];
  templates: TeamsMessageTemplateRecord[];
  webhooks: TeamsWebhookRecord[];
  leaderboardData?: DashboardLeaderboard | null;
  teamStandingsData?: TeamStandingsData | null;
}

interface AutomationFormState {
  name: string;
  trigger: TeamsAutomationTrigger;
  scope: TeamsAutomationScope;
  mode: TeamsAutomationMode;
  deliveryFormat: TeamsAutomationDeliveryFormat;
  messageTemplateId: string;
  campaignId: string;
  podId: string;
  outgoingWebhookId: string;
  titleTemplate: string;
  messageTemplate: string;
  // Schedule
  oneTimeAt: string;
  startsAt: string;
  endsAt: string;
  repeatEveryMinutes: number;
  // Conditions
  hasCondition: boolean;
  conditionMetric: TeamsAutomationConditionMetric;
  conditionMinimumValue: number;
  // Only send if new data
  onlyIfNewData: boolean;
  // Only send if competition activity in last X minutes
  hasActivityCondition: boolean;
  conditionActivityWithinMinutes: number;
  isActive: boolean;
}

const emptyForm: AutomationFormState = {
  name: "",
  trigger: "performanceLogged",
  scope: "global",
  mode: "event",
  deliveryFormat: "adaptiveCard",
  messageTemplateId: "",
  campaignId: "",
  podId: "",
  outgoingWebhookId: "",
  titleTemplate: "",
  messageTemplate: "",
  oneTimeAt: "",
  startsAt: "",
  endsAt: "",
  repeatEveryMinutes: 1440,
  hasCondition: false,
  conditionMetric: "count",
  conditionMinimumValue: 1,
  onlyIfNewData: false,
  hasActivityCondition: false,
  conditionActivityWithinMinutes: 15,
  isActive: true,
};

export function TeamsAutomationAdmin({
  initialAutomations,
  recentEvents,
  campaigns,
  pods,
  templates,
  webhooks,
  leaderboardData,
  teamStandingsData,
}: TeamsAutomationAdminProps) {
  const [automations, setAutomations] = useState(initialAutomations);
  const [activeTab, setActiveTab] = useState<"automations" | "events">("automations");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState<AutomationFormState>(emptyForm);
  const [pending, setPending] = useState(false);
  const [dialogTab, setDialogTab] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState<string | null>(null);

  // Filter to event-based automations (not scheduled)
  const eventAutomations = automations.filter((a) => a.mode === "event");

  function startEdit(automation: TeamsAutomationRecord) {
    setEditingId(automation.id);
    setForm({
      name: automation.name,
      trigger: automation.trigger,
      scope: automation.scope,
      mode: automation.mode,
      deliveryFormat: automation.deliveryFormat,
      messageTemplateId: automation.messageTemplateId || "",
      campaignId: automation.campaignId || "",
      podId: automation.podId || "",
      outgoingWebhookId: automation.outgoingWebhookId,
      titleTemplate: automation.titleTemplate,
      messageTemplate: automation.messageTemplate,
      oneTimeAt: automation.oneTimeAt ? automation.oneTimeAt.slice(0, 16) : "",
      startsAt: automation.startsAt ? automation.startsAt.slice(0, 16) : "",
      endsAt: automation.endsAt ? automation.endsAt.slice(0, 16) : "",
      repeatEveryMinutes: automation.repeatEveryMinutes || 1440,
      hasCondition: Boolean(automation.conditionMinimumValue && automation.conditionMinimumValue > 0),
      conditionMetric: automation.conditionMetric || "count",
      conditionMinimumValue: automation.conditionMinimumValue || 1,
      onlyIfNewData: automation.onlyIfNewData ?? false,
      hasActivityCondition: Boolean(automation.conditionActivityWithinMinutes && automation.conditionActivityWithinMinutes > 0),
      conditionActivityWithinMinutes: automation.conditionActivityWithinMinutes || 15,
      isActive: automation.isActive,
    });
    setDialogTab("edit");
    setError(null);
    setShowModal(true);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogTab("edit");
    setShowAdvanced(false);
    setError(null);
    setShowModal(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogTab("edit");
    setShowAdvanced(false);
    setError(null);
    setShowModal(false);
  }

  async function handleSubmit() {
    setPending(true);
    setError(null);

    const payload = {
      name: form.name,
      trigger: form.trigger,
      scope: form.scope,
      mode: form.mode,
      deliveryFormat: form.deliveryFormat,
      outgoingWebhookId: form.outgoingWebhookId,
      messageTemplateId: form.messageTemplateId || null,
      campaignId: form.scope === "campaign" && form.campaignId ? form.campaignId : null,
      podId: form.scope === "pod" && form.podId ? form.podId : null,
      titleTemplate: form.titleTemplate,
      messageTemplate: form.messageTemplate,
      oneTimeAt: form.mode === "oneTime" && form.oneTimeAt ? new Date(form.oneTimeAt).toISOString() : null,
      startsAt: form.mode === "recurring" && form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.mode === "recurring" && form.endsAt ? new Date(form.endsAt).toISOString() : null,
      repeatEveryMinutes: form.mode === "recurring" ? form.repeatEveryMinutes : null,
      conditionMetric: form.hasCondition ? form.conditionMetric : null,
      conditionMinimumValue: form.hasCondition ? form.conditionMinimumValue : null,
      onlyIfNewData: form.onlyIfNewData,
      conditionActivityWithinMinutes: form.hasActivityCondition ? form.conditionActivityWithinMinutes : null,
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
        setError(result.error ?? "Failed to save automation.");
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
      setError("Failed to save automation.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this automation?")) return;
    
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
      campaignId: automation.campaignId,
      podId: automation.podId,
      titleTemplate: automation.titleTemplate,
      messageTemplate: automation.messageTemplate,
      oneTimeAt: automation.oneTimeAt,
      startsAt: automation.startsAt,
      endsAt: automation.endsAt,
      repeatEveryMinutes: automation.repeatEveryMinutes,
      conditionMetric: automation.conditionMetric,
      conditionMinimumValue: automation.conditionMinimumValue,
      onlyIfNewData: automation.onlyIfNewData,
      conditionActivityWithinMinutes: automation.conditionActivityWithinMinutes,
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
  const selectedTemplate = templates.find(t => t.id === form.messageTemplateId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Automations</CardTitle>
          <CardDescription>
            Create "If This, Then That" rules for Teams notifications.
          </CardDescription>
        </div>
        <Button onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Automation
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "automations" | "events")}>
          <TabsList>
            <TabsTrigger value="automations">
              <Zap className="w-4 h-4 mr-2" />
              Automations
            </TabsTrigger>
            <TabsTrigger value="events">
              <Clock className="w-4 h-4 mr-2" />
              Recent Events
            </TabsTrigger>
          </TabsList>

          <TabsContent value="automations">
            {eventAutomations.length === 0 ? (
              <EmptyState
                icon={Zap}
                title="No automations yet"
                description="Create an automation to automatically send Teams messages when events happen."
                action={{
                  label: "Create Automation",
                  onClick: startCreate,
                }}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>IF (Trigger)</TableHead>
                    <TableHead>THEN (Channel)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventAutomations.map((automation) => (
                    <TableRow key={automation.id}>
                      <TableCell>
                        <div className="font-medium">{automation.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {automation.scope !== "global" && (
                            <span className="capitalize">{automation.scope}: {automation.campaignName || automation.podName}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status="pending" size="sm">
                          {TEAMS_AUTOMATION_TRIGGER_LABELS[automation.trigger]}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{automation.outgoingWebhookName}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {automation.titleTemplate}
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
            )}
          </TabsContent>

          <TabsContent value="events">
            {recentEvents.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No incoming webhook events yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Payload Preview</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(event.createdAt), "PPp")}
                      </TableCell>
                      <TableCell>{event.endpointName}</TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {event.payloadPreview}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Create/Edit Modal - IFTTT Style */}
      <Dialog open={showModal} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Automation" : "Create New Automation"}</DialogTitle>
            <DialogDescription>
              Set up an "If This, Then That" rule for Teams notifications.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as "edit" | "preview")} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="edit">Edit Workflow</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            
            <TabsContent value="edit" className="flex-1 overflow-y-auto px-1">
              <div className="grid gap-6 py-4">
            {/* Automation Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Automation Name</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                placeholder="e.g., Daily Score Update"
              />
            </div>

            {/* IF / THEN Sections */}
            <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-start">
              {/* IF Section */}
              <div className="p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-600">IF</span>
                  </div>
                  <span className="font-semibold">This happens...</span>
                </div>
                
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>When this event occurs:</Label>
                    <Select
                      value={form.trigger}
                      onValueChange={(value) => setForm((current) => ({ ...current, trigger: value as TeamsAutomationTrigger }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEAMS_AUTOMATION_TRIGGERS.map((trigger) => (
                          <SelectItem key={trigger} value={trigger}>
                            {TEAMS_AUTOMATION_TRIGGER_LABELS[trigger]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Scope:</Label>
                    <Select
                      value={form.scope}
                      onValueChange={(value) => setForm((current) => ({ ...current, scope: value as TeamsAutomationScope }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEAMS_AUTOMATION_SCOPES.map((scope) => (
                          <SelectItem key={scope} value={scope}>
                            {TEAMS_AUTOMATION_SCOPE_LABELS[scope]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {form.scope === "campaign" && (
                    <div className="grid gap-2">
                      <Label>Campaign:</Label>
                      <Select
                        value={form.campaignId}
                        onValueChange={(value) => setForm((current) => ({ ...current, campaignId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select campaign" />
                        </SelectTrigger>
                        <SelectContent>
                          {campaigns.map((campaign) => (
                            <SelectItem key={campaign.id} value={campaign.id}>
                              {campaign.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {form.scope === "pod" && (
                    <div className="grid gap-2">
                      <Label>Pod:</Label>
                      <Select
                        value={form.podId}
                        onValueChange={(value) => setForm((current) => ({ ...current, podId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select pod" />
                        </SelectTrigger>
                        <SelectContent>
                          {pods.map((pod) => (
                            <SelectItem key={pod.id} value={pod.id}>
                              {pod.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Optional Condition */}
                  <div className="flex items-center gap-2">
                    <Switch
                      id="hasCondition"
                      checked={form.hasCondition}
                      onCheckedChange={(checked) => setForm((current) => ({ ...current, hasCondition: checked }))}
                    />
                    <Label htmlFor="hasCondition">Only if condition is met</Label>
                  </div>

                  {form.hasCondition && (
                    <div className="grid grid-cols-2 gap-2 pl-4 border-l-2 border-yellow-300">
                      <Select
                        value={form.conditionMetric}
                        onValueChange={(value) => setForm((current) => ({ ...current, conditionMetric: value as TeamsAutomationConditionMetric }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEAMS_AUTOMATION_CONDITION_METRICS.map((metric) => (
                            <SelectItem key={metric} value={metric}>
                              {TEAMS_AUTOMATION_CONDITION_METRIC_LABELS[metric]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        value={form.conditionMinimumValue}
                        onChange={(e) => setForm((current) => ({ ...current, conditionMinimumValue: Number(e.target.value) }))}
                        placeholder="Min value"
                      />
                    </div>
                  )}

                  {/* Only if new data checkbox */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Switch
                      id="onlyIfNewData"
                      checked={form.onlyIfNewData}
                      onCheckedChange={(checked) => setForm((current) => ({ ...current, onlyIfNewData: checked }))}
                    />
                    <Label htmlFor="onlyIfNewData">Only send if there's new data</Label>
                  </div>

                  {/* Only if competition activity in last X minutes checkbox */}
                  <div className="flex items-center gap-2 pt-2">
                    <Switch
                      id="hasActivityCondition"
                      checked={form.hasActivityCondition}
                      onCheckedChange={(checked) => setForm((current) => ({ ...current, hasActivityCondition: checked }))}
                    />
                    <Label htmlFor="hasActivityCondition">Only if competition activity in last...</Label>
                    {form.hasActivityCondition && (
                      <Select
                        value={String(form.conditionActivityWithinMinutes)}
                        onValueChange={(value) => setForm((current) => ({ ...current, conditionActivityWithinMinutes: Number(value) }))}
                      >
                        <SelectTrigger className="w-32 h-8 ml-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEAMS_ACTIVITY_INTERVALS.map((interval) => (
                            <SelectItem key={interval.value} value={String(interval.value)}>
                              {interval.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center pt-8">
                <ArrowRight className="w-6 h-6 text-muted-foreground" />
              </div>

              {/* THEN Section */}
              <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/30">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-sm font-bold text-green-600">THEN</span>
                  </div>
                  <span className="font-semibold">Send to...</span>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Teams Channel:</Label>
                    <TeamsChannelSelect
                      webhooks={webhooks}
                      value={form.outgoingWebhookId}
                      onValueChange={(value) => setForm((current) => ({ ...current, outgoingWebhookId: value }))}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Message Template:</Label>
                    <Select
                      value={form.messageTemplateId || "__custom__"}
                      onValueChange={(value) => {
                        if (value === "__custom__") {
                          setForm((current) => ({ ...current, messageTemplateId: "" }));
                          return;
                        }
                        const template = templates.find(t => t.id === value);
                        setForm((current) => ({
                          ...current,
                          messageTemplateId: value,
                          titleTemplate: template?.titleTemplate || current.titleTemplate,
                          messageTemplate: template?.messageTemplate || current.messageTemplate,
                          deliveryFormat: template?.deliveryFormat || current.deliveryFormat,
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select template" />
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

                  <div className="grid gap-2">
                    <Label>Title:</Label>
                    <Input
                      value={form.titleTemplate}
                      onChange={(e) => setForm((current) => ({ ...current, titleTemplate: e.target.value }))}
                      placeholder="Message title"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Message:</Label>
                    <VariablePills 
                      onInsert={(code) => setForm((current) => ({ 
                        ...current, 
                        messageTemplate: current.messageTemplate + code 
                      }))} 
                    />
                    <Textarea
                      value={form.messageTemplate}
                      onChange={(e) => setForm((current) => ({ ...current, messageTemplate: e.target.value }))}
                      placeholder="Message content"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
            </div>

            {/* Advanced Options Toggle */}
            <div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-muted-foreground"
              >
                <Shield className="w-4 h-4 mr-2" />
                {showAdvanced ? "Hide" : "Show"} Advanced Options
              </Button>

              {showAdvanced && (
                <div className="mt-4 p-4 border rounded-lg space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Delivery Format:</Label>
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

                    <div className="grid gap-2">
                      <Label>Mode:</Label>
                      <Select
                        value={form.mode}
                        onValueChange={(value) => setForm((current) => ({ ...current, mode: value as TeamsAutomationMode }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEAMS_AUTOMATION_MODES.map((mode) => (
                            <SelectItem key={mode} value={mode}>
                              {TEAMS_AUTOMATION_MODE_LABELS[mode]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {form.mode === "oneTime" && (
                    <div className="grid gap-2">
                      <Label>Run once at:</Label>
                      <Input
                        type="datetime-local"
                        value={form.oneTimeAt}
                        onChange={(e) => setForm((current) => ({ ...current, oneTimeAt: e.target.value }))}
                      />
                    </div>
                  )}

                  {form.mode === "recurring" && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Start:</Label>
                          <Input
                            type="datetime-local"
                            value={form.startsAt}
                            onChange={(e) => setForm((current) => ({ ...current, startsAt: e.target.value }))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>End (optional):</Label>
                          <Input
                            type="datetime-local"
                            value={form.endsAt}
                            onChange={(e) => setForm((current) => ({ ...current, endsAt: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Repeat every:</Label>
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
                </div>
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
                />
                <Label htmlFor="isActive">Automation is active</Label>
              </div>

              {error && (
                <div className="text-sm font-medium text-destructive">{error}</div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="preview" className="flex-1 overflow-y-auto px-1">
            <div className="py-4">
              <h3 className="font-semibold mb-2">Preview</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  What will be sent to Teams when this workflow runs
                </p>
                
                {/* Preview Content */}
                {(() => {
                  // Build sample context from leaderboard data
                  const topEntry = leaderboardData?.rankings?.[0];
                  const secondEntry = leaderboardData?.rankings?.[1];
                  const thirdEntry = leaderboardData?.rankings?.[2];
                  
                  const sampleContext: Record<string, string> = {
                    agentName: topEntry?.userName || "John Smith",
                    agentScore: topEntry?.score?.toLocaleString() || "1,250",
                    agentRank: topEntry?.rank?.toString() || "1",
                    competitionName: leaderboardData?.name || "Q1 Sales Competition",
                    totalScore: leaderboardData?.rankings?.reduce((sum, r) => sum + r.score, 0)?.toLocaleString() || "45,000",
                    date: new Date().toLocaleDateString(),
                    time: new Date().toLocaleTimeString(),
                  };
                  
                  // Format leaderboard table
                  const leaderboard = leaderboardData?.rankings?.slice(0, 5).map(r => 
                    `#${r.rank} ${r.userName}: ${r.score.toLocaleString()} pts`
                  ).join('\n') || "#1 John Smith: 1,250 pts\n#2 Jane Doe: 1,100 pts\n#3 Bob Wilson: 950 pts";
                  
                  // Format team standings
                  const teamStandings = teamStandingsData?.teams?.map(t => 
                    `${t.rank === 1 ? '🏆' : t.rank === 2 ? '🥈' : t.rank === 3 ? '🥉' : ''} ${t.name}: ${t.score.toLocaleString()} pts`
                  ).join(' | ') || "🏆 Team Alpha: 5,000 pts | 🥈 Team Beta: 4,500 pts";
                  
                  sampleContext.leaderboard = leaderboard;
                  sampleContext.teamStandings = teamStandings;
                  sampleContext.podStandings = "1st Sales Pod: 3,000 pts | 2nd Support Pod: 2,800 pts";
                  
                  // Render title and message with variables replaced
                  const renderText = (text: string) => text.replace(
                    /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,
                    (_, key) => sampleContext[key] || `{{${key}}}`
                  );
                  
                  const renderedTitle = renderText(form.titleTemplate) || "Your Title Here";
                  const renderedMessage = renderText(form.messageTemplate) || "Your message content will appear here...";
                  
                  return (
                    <>
                      {/* No data notice */}
                      {!leaderboardData && (
                        <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground mb-4">
                          No active competition found. Preview shows sample values.
                        </div>
                      )}
                      
                      {/* Teams Message Card Preview */}
                      <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
                        {/* Hero Image (if applicable) */}
                        {form.deliveryFormat === "adaptiveCardWithImage" && (
                          <div className="bg-gradient-to-br from-green-600 to-green-700 p-4 text-white">
                            <div className="text-lg font-bold">{renderedTitle}</div>
                            <div className="text-4xl font-bold mt-1">{sampleContext.agentScore}</div>
                            <div className="text-sm opacity-90 mt-1">{sampleContext.agentRank} of {leaderboardData?.rankings?.length || 3} agents</div>
                          </div>
                        )}
                        
                        {/* Message Body */}
                        <div className="p-4">
                          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {renderedTitle}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                            {renderedMessage}
                          </div>
                          
                          {/* Leaderboard Table */}
                          {leaderboardData?.rankings && leaderboardData.rankings.length > 0 && (
                            <div className="mt-4 border-t pt-3">
                              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Leaderboard</div>
                              <div className="border rounded overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-muted">
                                      <th className="text-left p-2 font-medium">#</th>
                                      <th className="text-left p-2 font-medium">Agent</th>
                                      <th className="text-right p-2 font-medium">Score</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {leaderboardData.rankings.slice(0, 5).map((entry) => (
                                      <tr key={entry.id} className="border-t">
                                        <td className="p-2">{entry.rank}</td>
                                        <td className="p-2">{entry.userName}</td>
                                        <td className="p-2 text-right font-mono">{entry.score.toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                          
                          {/* Team Standings */}
                          {teamStandingsData?.teams && teamStandingsData.teams.length > 0 && (
                            <div className="mt-4 border-t pt-3">
                              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Team Standings</div>
                              <div className="text-sm space-y-1">
                                {teamStandingsData.teams.slice(0, 3).map((team) => (
                                  <div key={team.id} className="flex justify-between">
                                    <span>
                                      {team.rank === 1 ? '🏆' : team.rank === 2 ? '🥈' : team.rank === 3 ? '🥉' : `#${team.rank}`}{' '}
                                      {team.name}
                                    </span>
                                    <span className="font-mono">{team.score.toLocaleString()} pts</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Format Badge */}
                          <div className="mt-4 pt-3 border-t flex items-center justify-between">
                            <span className="text-xs text-gray-400">Format:</span>
                            <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                              {TEAMS_AUTOMATION_DELIVERY_FORMAT_LABELS[form.deliveryFormat]}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Channel Info */}
                      <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
                        <div className="font-medium">Sending to:</div>
                        <div className="text-muted-foreground">
                          {webhooks.find(w => w.id === form.outgoingWebhookId)?.name || "No channel selected"}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending ? "Saving..." : editingId ? "Update Automation" : "Create Automation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
