"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AppCampaign,
  AppPod,
  TEAMS_AUTOMATION_CONDITION_EVENTS,
  TEAMS_AUTOMATION_CONDITION_METRICS,
  TEAMS_AUTOMATION_DELIVERY_FORMATS,
  TEAMS_AUTOMATION_MODES,
  TEAMS_AUTOMATION_SCOPES,
  TEAMS_AUTOMATION_TRIGGERS,
  TeamsAutomationConditionEvent,
  TeamsAutomationConditionMetric,
  TeamsAutomationDeliveryFormat,
  TeamsAutomationMode,
  TeamsAutomationRecord,
  TeamsAutomationScope,
  TeamsAutomationTrigger,
  TeamsIncomingEventRecord,
  TeamsMessageTemplateRecord,
  TeamsWebhookRecord,
} from "@/lib/contracts";
import {
  TEAMS_AUTOMATION_PRESETS,
  TEAMS_AUTOMATION_PREVIEW_CONTEXT,
  TeamsAutomationPreset,
} from "@/lib/teams-automation-presets";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TeamsAutomationAdminProps {
  initialAutomations: TeamsAutomationRecord[];
  recentEvents: TeamsIncomingEventRecord[];
  campaigns: AppCampaign[];
  pods: AppPod[];
  templates: TeamsMessageTemplateRecord[];
  webhooks: TeamsWebhookRecord[];
}

interface FactState {
  name: string;
  valueTemplate: string;
}

interface FormState {
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
  facts: FactState[];
  adaptiveCardJson: string;
  imageTitleTemplate: string;
  imageSubtitleTemplate: string;
  imageMetricTemplate: string;
  imageFooterTemplate: string;
  imageAccentColor: string;
  oneTimeAt: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  windowStartTime: string;
  windowEndTime: string;
  quietStartTime: string;
  quietEndTime: string;
  repeatEveryMinutes: string;
  batchWindowMinutes: string;
  cooldownMinutes: string;
  conditionEvent: TeamsAutomationConditionEvent | "";
  conditionMetric: TeamsAutomationConditionMetric | "";
  conditionLookbackMinutes: string;
  conditionMinimumCount: string;
  conditionMinimumValue: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  name: "",
  trigger: "incomingWebhookReceived",
  scope: "global",
  mode: "event",
  deliveryFormat: "messageCard",
  messageTemplateId: "",
  campaignId: "",
  podId: "",
  outgoingWebhookId: "",
  titleTemplate: "",
  messageTemplate: "",
  facts: [{ name: "", valueTemplate: "" }],
  adaptiveCardJson: "",
  imageTitleTemplate: "",
  imageSubtitleTemplate: "",
  imageMetricTemplate: "",
  imageFooterTemplate: "",
  imageAccentColor: "007A5A",
  oneTimeAt: "",
  startsAt: "",
  endsAt: "",
  timezone: "UTC",
  windowStartTime: "",
  windowEndTime: "",
  quietStartTime: "",
  quietEndTime: "",
  repeatEveryMinutes: "",
  batchWindowMinutes: "",
  cooldownMinutes: "",
  conditionEvent: "",
  conditionMetric: "",
  conditionLookbackMinutes: "",
  conditionMinimumCount: "",
  conditionMinimumValue: "",
  isActive: true,
};

export function TeamsAutomationAdmin({
  initialAutomations,
  recentEvents,
  campaigns,
  pods,
  templates,
  webhooks,
}: TeamsAutomationAdminProps) {
  const initialOutgoingWebhookId =
    webhooks.find((webhook) => webhook.direction === "outgoing" && webhook.isActive)?.id ?? "";
  const [automations, setAutomations] = useState(initialAutomations);
  const [templateOptions, setTemplateOptions] = useState(templates);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    ...emptyForm,
    outgoingWebhookId: initialOutgoingWebhookId,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outgoingWebhooks = useMemo(
    () => webhooks.filter((webhook) => webhook.direction === "outgoing" && webhook.isActive),
    [webhooks]
  );
  const incomingWebhooks = useMemo(
    () => webhooks.filter((webhook) => webhook.direction === "incoming" && webhook.isActive),
    [webhooks]
  );
  const preview = useMemo(() => buildPreview(form), [form]);

  useEffect(() => {
    if (!editingId && !form.outgoingWebhookId && outgoingWebhooks[0]?.id) {
      setForm((current) => ({ ...current, outgoingWebhookId: outgoingWebhooks[0]?.id ?? "" }));
    }
  }, [editingId, form.outgoingWebhookId, outgoingWebhooks]);

  function resetForm() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      outgoingWebhookId: outgoingWebhooks[0]?.id ?? "",
    });
    setError(null);
  }

  function startEdit(automation: TeamsAutomationRecord) {
    setEditingId(automation.id);
    setForm({
      name: automation.name,
      trigger: automation.trigger,
      scope: automation.scope,
      mode: automation.mode,
      deliveryFormat: automation.deliveryFormat,
      messageTemplateId: automation.messageTemplateId ?? "",
      campaignId: automation.campaignId ?? "",
      podId: automation.podId ?? "",
      outgoingWebhookId: automation.outgoingWebhookId,
      titleTemplate: automation.titleTemplate,
      messageTemplate: automation.messageTemplate,
      facts: automation.facts.length > 0 ? automation.facts : [{ name: "", valueTemplate: "" }],
      adaptiveCardJson: automation.adaptiveCardJson ?? "",
      imageTitleTemplate: automation.imageTitleTemplate ?? "",
      imageSubtitleTemplate: automation.imageSubtitleTemplate ?? "",
      imageMetricTemplate: automation.imageMetricTemplate ?? "",
      imageFooterTemplate: automation.imageFooterTemplate ?? "",
      imageAccentColor: automation.imageAccentColor ?? "007A5A",
      oneTimeAt: toDateTimeLocalValue(automation.oneTimeAt),
      startsAt: toDateTimeLocalValue(automation.startsAt),
      endsAt: toDateTimeLocalValue(automation.endsAt),
      timezone: automation.timezone ?? "UTC",
      windowStartTime: automation.windowStartTime ?? "",
      windowEndTime: automation.windowEndTime ?? "",
      quietStartTime: automation.quietStartTime ?? "",
      quietEndTime: automation.quietEndTime ?? "",
      repeatEveryMinutes: automation.repeatEveryMinutes ? String(automation.repeatEveryMinutes) : "",
      batchWindowMinutes: automation.batchWindowMinutes ? String(automation.batchWindowMinutes) : "",
      cooldownMinutes: automation.cooldownMinutes ? String(automation.cooldownMinutes) : "",
      conditionEvent: automation.conditionEvent ?? "",
      conditionMetric: automation.conditionMetric ?? "",
      conditionLookbackMinutes: automation.conditionLookbackMinutes
        ? String(automation.conditionLookbackMinutes)
        : "",
      conditionMinimumCount: automation.conditionMinimumCount
        ? String(automation.conditionMinimumCount)
        : "",
      conditionMinimumValue: automation.conditionMinimumValue
        ? String(automation.conditionMinimumValue)
        : "",
      isActive: automation.isActive,
    });
    setError(null);
  }

  function applyPreset(preset: TeamsAutomationPreset) {
    setForm((current) => ({
      ...current,
      deliveryFormat: preset.deliveryFormat,
      titleTemplate: preset.titleTemplate,
      messageTemplate: preset.messageTemplate,
      facts: preset.facts.length > 0 ? preset.facts : current.facts,
      adaptiveCardJson: preset.adaptiveCardJson,
      imageTitleTemplate: preset.imageTitleTemplate,
      imageSubtitleTemplate: preset.imageSubtitleTemplate,
      imageMetricTemplate: preset.imageMetricTemplate,
      imageFooterTemplate: preset.imageFooterTemplate,
      imageAccentColor: preset.imageAccentColor,
    }));
  }

  function applySharedTemplate(templateId: string) {
    const template = templateOptions.find((entry) => entry.id === templateId);
    if (!template) {
      setForm((current) => ({ ...current, messageTemplateId: "" }));
      return;
    }

    setForm((current) => ({
      ...current,
      messageTemplateId: template.id,
      deliveryFormat: template.deliveryFormat,
      titleTemplate: template.titleTemplate,
      messageTemplate: template.messageTemplate,
      facts: template.facts.length > 0 ? template.facts : current.facts,
      adaptiveCardJson: template.adaptiveCardJson ?? "",
      imageTitleTemplate: template.imageTitleTemplate ?? "",
      imageSubtitleTemplate: template.imageSubtitleTemplate ?? "",
      imageMetricTemplate: template.imageMetricTemplate ?? "",
      imageFooterTemplate: template.imageFooterTemplate ?? "",
      imageAccentColor: template.imageAccentColor ?? "007A5A",
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch(
      editingId ? `/api/integrations/teams-automations/${editingId}` : "/api/integrations/teams-automations",
      {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          trigger: form.trigger,
          scope: form.scope,
          mode: form.mode,
          deliveryFormat: form.deliveryFormat,
          messageTemplateId: form.messageTemplateId || null,
          campaignId: form.scope === "campaign" ? form.campaignId || null : null,
          podId: form.scope === "pod" ? form.podId || null : null,
          outgoingWebhookId: form.outgoingWebhookId,
          titleTemplate: form.titleTemplate,
          messageTemplate: form.messageTemplate,
          facts: form.facts.filter((fact) => fact.name.trim() && fact.valueTemplate.trim()),
          adaptiveCardJson: form.adaptiveCardJson || null,
          imageTitleTemplate: form.imageTitleTemplate || null,
          imageSubtitleTemplate: form.imageSubtitleTemplate || null,
          imageMetricTemplate: form.imageMetricTemplate || null,
          imageFooterTemplate: form.imageFooterTemplate || null,
          imageAccentColor: form.imageAccentColor || null,
          oneTimeAt: form.oneTimeAt || null,
          startsAt: form.startsAt || null,
          endsAt: form.endsAt || null,
          timezone: form.timezone || "UTC",
          windowStartTime: form.windowStartTime || null,
          windowEndTime: form.windowEndTime || null,
          quietStartTime: form.quietStartTime || null,
          quietEndTime: form.quietEndTime || null,
          repeatEveryMinutes: form.repeatEveryMinutes ? Number(form.repeatEveryMinutes) : null,
          batchWindowMinutes: form.batchWindowMinutes ? Number(form.batchWindowMinutes) : null,
          cooldownMinutes: form.cooldownMinutes ? Number(form.cooldownMinutes) : null,
          conditionEvent: form.conditionEvent || null,
          conditionMetric: form.conditionMetric || null,
          conditionLookbackMinutes: form.conditionLookbackMinutes
            ? Number(form.conditionLookbackMinutes)
            : null,
          conditionMinimumCount: form.conditionMinimumCount
            ? Number(form.conditionMinimumCount)
            : null,
          conditionMinimumValue: form.conditionMinimumValue
            ? Number(form.conditionMinimumValue)
            : null,
          isActive: form.isActive,
        }),
      }
    );

    const payload = await response.json();
    setPending(false);

    if (!response.ok) {
      setError(payload.error ?? "Failed to save Teams automation.");
      return;
    }

    if (editingId) {
      setAutomations((current) =>
        current.map((automation) => (automation.id === payload.id ? payload : automation))
      );
    } else {
      setAutomations((current) => [payload, ...current]);
    }

    resetForm();
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="flex flex-col gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Automation rules</CardTitle>
            <CardDescription>
              Reusable Teams automations can target a campaign, a pod, or run globally. Outgoing
              endpoints stay centralized.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {automations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Teams automations configured yet.</p>
              ) : (
                <div className="flex flex-col gap-4 pr-4">
                  {automations.map((automation) => (
                    <div
                      key={automation.id}
                      className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{automation.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                            {automation.trigger}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {automation.scope}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${automation.isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {automation.isActive ? "active" : "inactive"}
                          </span>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => startEdit(automation)}
                        >
                          Edit
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {automation.scope === "campaign"
                          ? automation.campaignName
                          : automation.scope === "pod"
                          ? automation.podName
                          : "All campaigns and pods"}
                        {" -> "}
                        {automation.outgoingWebhookName}
                      </p>
                      <div className="text-xs text-muted-foreground mt-1">
                        {describeAutomation(automation)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Recent inbound events</CardTitle>
            <CardDescription>
              Incoming Teams webhook posts are captured here, then matched to automation rules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No inbound Teams events captured yet.</p>
              ) : (
                <div className="flex flex-col gap-4 pr-4">
                  {recentEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-card/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{event.endpointName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                          incoming
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground break-all">
                        {event.payloadPreview}
                      </p>
                      <div className="text-xs text-muted-foreground font-mono">
                        POST /api/integrations/teams/incoming/{event.endpointId}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Active incoming endpoints</CardTitle>
            <CardDescription>
              These endpoint ids are the public URLs for inbound Teams posts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {incomingWebhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-card/50"
                >
                  <span className="font-semibold">{webhook.name}</span>
                  <p className="text-sm text-muted-foreground">
                    {webhook.description || webhook.url}
                  </p>
                  <div className="text-xs text-muted-foreground font-mono">
                    /api/integrations/teams/incoming/{webhook.id}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex flex-col gap-1">
              <CardTitle>{editingId ? "Edit automation" : "Create automation"}</CardTitle>
              <CardDescription>
                Supported template tokens: {"{{endpointName}}"}, {"{{campaignName}}"},{" "}
                {"{{podName}}"}, {"{{payloadText}}"}, {"{{payloadSummary}}"}, {"{{payloadTitle}}"},{" "}
                {"{{payloadJson}}"}, {"{{userName}}"}, {"{{trackerName}}"}, {"{{competitionName}}"}.
              </CardDescription>
            </div>
            {editingId && (
              <Button variant="outline" size="sm" onClick={resetForm}>
                New automation
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label>Presets</Label>
                <div className="flex flex-wrap gap-2">
                  {TEAMS_AUTOMATION_PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      variant="secondary"
                      size="sm"
                      onClick={() => applyPreset(preset)}
                      type="button"
                    >
                      {preset.name}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Start from a preset, then adjust the templates and card JSON.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="trigger">Trigger</Label>
                  <Select
                    value={form.trigger}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        trigger: value as TeamsAutomationTrigger,
                      }))
                    }
                  >
                    <SelectTrigger id="trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAMS_AUTOMATION_TRIGGERS.map((trigger) => (
                        <SelectItem key={trigger} value={trigger}>
                          {trigger}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="scope">Scope</Label>
                  <Select
                    value={form.scope}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        scope: value as TeamsAutomationScope,
                      }))
                    }
                  >
                    <SelectTrigger id="scope">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAMS_AUTOMATION_SCOPES.map((scope) => (
                        <SelectItem key={scope} value={scope}>
                          {scope}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="mode">Mode</Label>
                  <Select
                    value={form.mode}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        mode: value as TeamsAutomationMode,
                      }))
                    }
                  >
                    <SelectTrigger id="mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAMS_AUTOMATION_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {mode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="deliveryFormat">Delivery format</Label>
                  <Select
                    value={form.deliveryFormat}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        deliveryFormat: value as TeamsAutomationDeliveryFormat,
                      }))
                    }
                  >
                    <SelectTrigger id="deliveryFormat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAMS_AUTOMATION_DELIVERY_FORMATS.map((format) => (
                        <SelectItem key={format} value={format}>
                          {format}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sharedTemplate">Shared template</Label>
                <Select
                  value={form.messageTemplateId}
                  onValueChange={(value) => applySharedTemplate(value)}
                >
                  <SelectTrigger id="sharedTemplate">
                    <SelectValue placeholder="No shared template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No shared template</SelectItem>
                    {templateOptions.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} v{template.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={form.timezone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, timezone: event.target.value }))
                  }
                  placeholder="Europe/London"
                />
              </div>

              {form.scope === "campaign" && (
                <div className="grid gap-2">
                  <Label htmlFor="campaignId">Campaign</Label>
                  <Select
                    value={form.campaignId}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, campaignId: value }))
                    }
                  >
                    <SelectTrigger id="campaignId">
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
                  <Label htmlFor="podId">Pod</Label>
                  <Select
                    value={form.podId}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, podId: value }))
                    }
                  >
                    <SelectTrigger id="podId">
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

              <div className="grid gap-2">
                <Label htmlFor="outgoingWebhookId">Outgoing webhook</Label>
                <Select
                  value={form.outgoingWebhookId}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, outgoingWebhookId: value }))
                  }
                >
                  <SelectTrigger id="outgoingWebhookId">
                    <SelectValue placeholder="Select outgoing webhook" />
                  </SelectTrigger>
                  <SelectContent>
                    {outgoingWebhooks.map((webhook) => (
                      <SelectItem key={webhook.id} value={webhook.id}>
                        {webhook.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="titleTemplate">Title template</Label>
                <Input
                  id="titleTemplate"
                  required
                  value={form.titleTemplate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, titleTemplate: event.target.value }))
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="messageTemplate">Message template</Label>
                <Textarea
                  id="messageTemplate"
                  required
                  rows={5}
                  value={form.messageTemplate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, messageTemplate: event.target.value }))
                  }
                />
              </div>

              {form.deliveryFormat !== "messageCard" && (
                <div className="grid gap-2">
                  <Label htmlFor="adaptiveCardJson">Adaptive card JSON template</Label>
                  <Textarea
                    id="adaptiveCardJson"
                    rows={10}
                    value={form.adaptiveCardJson}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, adaptiveCardJson: event.target.value }))
                    }
                    placeholder={'{"type":"AdaptiveCard","version":"1.4","body":[{"type":"TextBlock","text":"{{userName}}"}]}'}
                  />
                </div>
              )}

              {form.deliveryFormat === "adaptiveCardWithImage" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="imageTitleTemplate">Image title template</Label>
                    <Input
                      id="imageTitleTemplate"
                      value={form.imageTitleTemplate}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, imageTitleTemplate: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="imageSubtitleTemplate">Image subtitle template</Label>
                    <Input
                      id="imageSubtitleTemplate"
                      value={form.imageSubtitleTemplate}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, imageSubtitleTemplate: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="imageMetricTemplate">Image metric template</Label>
                    <Input
                      id="imageMetricTemplate"
                      value={form.imageMetricTemplate}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, imageMetricTemplate: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="imageFooterTemplate">Image footer template</Label>
                    <Input
                      id="imageFooterTemplate"
                      value={form.imageFooterTemplate}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, imageFooterTemplate: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="imageAccentColor">Image accent color</Label>
                    <Input
                      id="imageAccentColor"
                      value={form.imageAccentColor}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, imageAccentColor: event.target.value }))
                      }
                      placeholder="007A5A"
                    />
                  </div>
                </>
              )}

              {form.mode === "oneTime" && (
                <div className="grid gap-2">
                  <Label htmlFor="oneTimeAt">Send once at</Label>
                  <Input
                    id="oneTimeAt"
                    type="datetime-local"
                    value={form.oneTimeAt}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, oneTimeAt: event.target.value }))
                    }
                  />
                </div>
              )}

              {form.mode === "recurring" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="repeatEveryMinutes">Repeat every minutes</Label>
                    <Input
                      id="repeatEveryMinutes"
                      type="number"
                      min={1}
                      value={form.repeatEveryMinutes}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, repeatEveryMinutes: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="startsAt">Starts at</Label>
                      <Input
                        id="startsAt"
                        type="datetime-local"
                        value={form.startsAt}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, startsAt: event.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="endsAt">Ends at</Label>
                      <Input
                        id="endsAt"
                        type="datetime-local"
                        value={form.endsAt}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, endsAt: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="windowStartTime">Window start</Label>
                      <Input
                        id="windowStartTime"
                        type="time"
                        value={form.windowStartTime}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, windowStartTime: event.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="windowEndTime">Window end</Label>
                      <Input
                        id="windowEndTime"
                        type="time"
                        value={form.windowEndTime}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, windowEndTime: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="quietStartTime">Quiet start</Label>
                  <Input
                    id="quietStartTime"
                    type="time"
                    value={form.quietStartTime}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, quietStartTime: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="quietEndTime">Quiet end</Label>
                  <Input
                    id="quietEndTime"
                    type="time"
                    value={form.quietEndTime}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, quietEndTime: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="batchWindowMinutes">Batch window minutes</Label>
                  <Input
                    id="batchWindowMinutes"
                    type="number"
                    min={1}
                    value={form.batchWindowMinutes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, batchWindowMinutes: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cooldownMinutes">Cooldown minutes</Label>
                  <Input
                    id="cooldownMinutes"
                    type="number"
                    min={1}
                    value={form.cooldownMinutes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, cooldownMinutes: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="conditionEvent">Only send if recent activity exists</Label>
                <Select
                  value={form.conditionEvent}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      conditionEvent: value as TeamsAutomationConditionEvent | "",
                    }))
                  }
                >
                  <SelectTrigger id="conditionEvent">
                    <SelectValue placeholder="No guard" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No guard</SelectItem>
                    {TEAMS_AUTOMATION_CONDITION_EVENTS.map((conditionEvent) => (
                      <SelectItem key={conditionEvent} value={conditionEvent}>
                        {conditionEvent}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.conditionEvent && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="conditionMetric">Condition metric</Label>
                    <Select
                      value={form.conditionMetric}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          conditionMetric: value as TeamsAutomationConditionMetric | "",
                        }))
                      }
                    >
                      <SelectTrigger id="conditionMetric">
                        <SelectValue placeholder="count" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">count</SelectItem>
                        {TEAMS_AUTOMATION_CONDITION_METRICS.map((metric) => (
                          <SelectItem key={metric} value={metric}>
                            {metric}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="conditionLookbackMinutes">Look back minutes</Label>
                    <Input
                      id="conditionLookbackMinutes"
                      type="number"
                      min={1}
                      value={form.conditionLookbackMinutes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          conditionLookbackMinutes: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="conditionMinimumCount">Minimum activity count</Label>
                    <Input
                      id="conditionMinimumCount"
                      type="number"
                      min={1}
                      value={form.conditionMinimumCount}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, conditionMinimumCount: event.target.value }))
                      }
                    />
                  </div>
                  {form.conditionMetric === "totalValue" && (
                    <div className="grid gap-2">
                      <Label htmlFor="conditionMinimumValue">Minimum activity value</Label>
                      <Input
                        id="conditionMinimumValue"
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.conditionMinimumValue}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, conditionMinimumValue: event.target.value }))
                        }
                      />
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2">
                <Label>Facts</Label>
                <div className="flex flex-col gap-2">
                  {form.facts.map((fact, index) => (
                    <div className="flex gap-2" key={`${fact.name}-${index}`}>
                      <Input
                        placeholder="Fact name"
                        value={fact.name}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            facts: current.facts.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, name: event.target.value } : entry
                            ),
                          }))
                        }
                      />
                      <Input
                        placeholder="Value template"
                        value={fact.valueTemplate}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            facts: current.facts.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, valueTemplate: event.target.value } : entry
                            ),
                          }))
                        }
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        facts: [...current.facts, { name: "", valueTemplate: "" }],
                      }))
                    }
                  >
                    Add fact
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, isActive: checked }))
                  }
                />
                <Label htmlFor="isActive">Automation is active</Label>
              </div>

              {error && <div className="text-sm font-medium text-destructive">{error}</div>}

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Saving..." : editingId ? "Update automation" : "Create automation"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <TeamsTemplateManager
          templates={templateOptions}
          onTemplatesChange={setTemplateOptions}
        />

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Preview uses sample data so admins can see the card or image shape before saving.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 p-3 rounded-md border border-border bg-card/50">
                <span className="font-semibold text-sm">Resolved message</span>
                <p className="text-sm">{preview.title}</p>
                <p className="text-xs text-muted-foreground">{preview.text}</p>
              </div>

              {form.deliveryFormat === "messageCard" && (
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-sm">Message card preview</span>
                  <div className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-background shadow-sm">
                    <h3 className="font-bold text-lg">{preview.title}</h3>
                    <p className="text-sm">{preview.text}</p>
                    {preview.facts.length > 0 && (
                      <div className="grid grid-cols-1 gap-1 pt-2">
                        {preview.facts.map((fact) => (
                          <div
                            className="flex justify-between text-xs"
                            key={`${fact.name}-${fact.value}`}
                          >
                            <strong className="text-muted-foreground">{fact.name}</strong>
                            <span>{fact.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {form.deliveryFormat !== "messageCard" && (
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-sm">Adaptive card preview</span>
                  <div className="p-4 rounded-lg border border-border bg-background shadow-sm">
                    {preview.cardError ? (
                      <p className="text-sm text-destructive">{preview.cardError}</p>
                    ) : (
                      <AdaptiveCardPreview payload={preview.cardPayload} />
                    )}
                  </div>
                </div>
              )}

              {form.deliveryFormat === "adaptiveCardWithImage" && (
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-sm">Generated image preview</span>
                  <img
                    alt="Teams image preview"
                    src={preview.imageUrl}
                    className="w-full rounded-lg border border-border mt-2"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper functions (toDateTimeLocalValue, describeAutomation, buildPreview, renderLocalTemplate) remain the same...
// ... (I will include them in the full file write)

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 16);
}

function describeAutomation(automation: TeamsAutomationRecord) {
  const parts = [automation.titleTemplate];

  if (automation.mode === "oneTime" && automation.oneTimeAt) {
    parts.push(`once at ${automation.oneTimeAt}`);
  }

  if (automation.mode === "recurring") {
    parts.push(`every ${automation.repeatEveryMinutes ?? "?"} min`);
    if (automation.windowStartTime || automation.windowEndTime) {
      parts.push(
        `window ${automation.windowStartTime ?? "00:00"}-${
          automation.windowEndTime ?? "24:00"
        } ${automation.timezone ?? "UTC"}`
      );
    }
  }

  if (automation.quietStartTime || automation.quietEndTime) {
    parts.push(
      `quiet ${automation.quietStartTime ?? "00:00"}-${
        automation.quietEndTime ?? "24:00"
      } ${automation.timezone ?? "UTC"}`
    );
  }

  if (automation.batchWindowMinutes) {
    parts.push(`batch ${automation.batchWindowMinutes} min`);
  }

  if (automation.conditionEvent && automation.conditionLookbackMinutes) {
    parts.push(
      automation.conditionMetric === "totalValue"
        ? `only if ${automation.conditionEvent} value >= ${
            automation.conditionMinimumValue ?? 0
          } in last ${automation.conditionLookbackMinutes} min`
        : `only if ${automation.conditionEvent} >= ${
            automation.conditionMinimumCount ?? 1
          } in last ${automation.conditionLookbackMinutes} min`
    );
  }

  if (automation.cooldownMinutes) {
    parts.push(`cooldown ${automation.cooldownMinutes} min`);
  }

  return parts.join(" | ");
}

function buildPreview(form: FormState) {
  const context = {
    ...TEAMS_AUTOMATION_PREVIEW_CONTEXT,
  };
  const title = renderLocalTemplate(form.titleTemplate, context);
  const text = renderLocalTemplate(form.messageTemplate, context);
  const facts = form.facts
    .filter((fact) => fact.name.trim() && fact.valueTemplate.trim())
    .map((fact) => ({
      name: fact.name,
      value: renderLocalTemplate(fact.valueTemplate, context),
    }));
  const imageUrl = `/api/render/teams-image?${new URLSearchParams({
    title: renderLocalTemplate(form.imageTitleTemplate || form.titleTemplate, context),
    subtitle: renderLocalTemplate(form.imageSubtitleTemplate || form.messageTemplate, context),
    metric: renderLocalTemplate(form.imageMetricTemplate, context),
    footer: renderLocalTemplate(form.imageFooterTemplate, context),
    accent: (form.imageAccentColor || "007A5A").replace("#", ""),
  }).toString()}`;

  if (form.deliveryFormat === "messageCard") {
    return {
      title,
      text,
      facts,
      imageUrl,
      cardPayload: null,
      cardError: null,
    };
  }

  const defaultCard = {
    type: "AdaptiveCard",
    version: "1.4",
    body: [
      { type: "TextBlock", size: "Large", weight: "Bolder", text: title, wrap: true },
      { type: "TextBlock", text, wrap: true },
      ...(form.deliveryFormat === "adaptiveCardWithImage"
        ? [{ type: "Image", url: imageUrl, size: "Stretch" }]
        : []),
      ...(facts.length > 0
        ? [{ type: "FactSet", facts: facts.map((fact) => ({ title: fact.name, value: fact.value })) }]
        : []),
    ],
  };

  try {
    const cardPayload =
      form.adaptiveCardJson.trim().length > 0
        ? JSON.parse(renderLocalTemplate(form.adaptiveCardJson, { ...context, imageUrl }))
        : defaultCard;

    return {
      title,
      text,
      facts,
      imageUrl,
      cardPayload,
      cardError: null,
    };
  } catch (error) {
    return {
      title,
      text,
      facts,
      imageUrl,
      cardPayload: null,
      cardError: error instanceof Error ? error.message : "Invalid adaptive card JSON.",
    };
  }
}

function renderLocalTemplate(template: string, context: Record<string, string>) {
  return template.replace(
    /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,
    (_, key: string) => context[key] ?? ""
  );
}

function AdaptiveCardPreview({ payload }: { payload: any }) {
  if (!payload || typeof payload !== "object") {
    return <p className="text-sm text-muted-foreground">No adaptive card payload.</p>;
  }

  const body = Array.isArray(payload.body) ? payload.body : [];

  return (
    <div className="flex flex-col gap-2">
      {body.map((block: unknown, index: number) => {
        if (!block || typeof block !== "object") {
          return null;
        }
        const record = block as Record<string, unknown>;

        if (record.type === "TextBlock") {
          return (
            <div key={index}>
              <p
                style={{
                  fontSize: record.size === "Large" ? "1.25rem" : "1rem",
                  fontWeight: record.weight === "Bolder" ? 700 : 400,
                }}
              >
                {typeof record.text === "string" ? record.text : ""}
              </p>
            </div>
          );
        }

        if (record.type === "Image" && typeof record.url === "string") {
          return (
            <img
              alt="Adaptive card preview"
              key={index}
              src={record.url}
              className="w-full rounded-lg"
            />
          );
        }

        if (record.type === "FactSet" && Array.isArray(record.facts)) {
          return (
            <div className="flex flex-col gap-1" key={index}>
              {record.facts.map((fact, factIndex) => {
                if (!fact || typeof fact !== "object") {
                  return null;
                }
                const item = fact as Record<string, unknown>;
                return (
                  <div className="flex justify-between text-sm" key={factIndex}>
                    <strong className="text-muted-foreground">
                      {typeof item.title === "string" ? item.title : ""}
                    </strong>
                    <span>{typeof item.value === "string" ? item.value : ""}</span>
                  </div>
                );
              })}
            </div>
          );
        }

        return (
          <pre
            key={index}
            className="text-xs bg-muted p-2 rounded overflow-x-auto"
          >
            {JSON.stringify(record, null, 2)}
          </pre>
        );
      })}
    </div>
  );
}

interface TeamsTemplateManagerProps {
  templates: TeamsMessageTemplateRecord[];
  onTemplatesChange: (templates: TeamsMessageTemplateRecord[]) => void;
}

interface TemplateFormState {
  name: string;
  deliveryFormat: TeamsAutomationDeliveryFormat;
  titleTemplate: string;
  messageTemplate: string;
  adaptiveCardJson: string;
  imageTitleTemplate: string;
  imageSubtitleTemplate: string;
  imageMetricTemplate: string;
  imageFooterTemplate: string;
  imageAccentColor: string;
  facts: FactState[];
  isActive: boolean;
}

const emptyTemplateForm: TemplateFormState = {
  name: "",
  deliveryFormat: "messageCard",
  titleTemplate: "",
  messageTemplate: "",
  adaptiveCardJson: "",
  imageTitleTemplate: "",
  imageSubtitleTemplate: "",
  imageMetricTemplate: "",
  imageFooterTemplate: "",
  imageAccentColor: "007A5A",
  facts: [{ name: "", valueTemplate: "" }],
  isActive: true,
};

function TeamsTemplateManager({ templates, onTemplatesChange }: TeamsTemplateManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateFormState>(emptyTemplateForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(template: TeamsMessageTemplateRecord) {
    setEditingId(template.id);
    setForm({
      name: template.name,
      deliveryFormat: template.deliveryFormat,
      titleTemplate: template.titleTemplate,
      messageTemplate: template.messageTemplate,
      adaptiveCardJson: template.adaptiveCardJson ?? "",
      imageTitleTemplate: template.imageTitleTemplate ?? "",
      imageSubtitleTemplate: template.imageSubtitleTemplate ?? "",
      imageMetricTemplate: template.imageMetricTemplate ?? "",
      imageFooterTemplate: template.imageFooterTemplate ?? "",
      imageAccentColor: template.imageAccentColor ?? "007A5A",
      facts: template.facts.length > 0 ? template.facts : [{ name: "", valueTemplate: "" }],
      isActive: template.isActive,
    });
    setError(null);
  }

  function resetTemplateForm() {
    setEditingId(null);
    setForm(emptyTemplateForm);
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch(
      editingId
        ? `/api/integrations/teams-message-templates/${editingId}`
        : "/api/integrations/teams-message-templates",
      {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          deliveryFormat: form.deliveryFormat,
          titleTemplate: form.titleTemplate,
          messageTemplate: form.messageTemplate,
          adaptiveCardJson: form.adaptiveCardJson || null,
          imageTitleTemplate: form.imageTitleTemplate || null,
          imageSubtitleTemplate: form.imageSubtitleTemplate || null,
          imageMetricTemplate: form.imageMetricTemplate || null,
          imageFooterTemplate: form.imageFooterTemplate || null,
          imageAccentColor: form.imageAccentColor || null,
          facts: form.facts.filter((fact) => fact.name.trim() && fact.valueTemplate.trim()),
          isActive: form.isActive,
        }),
      }
    );

    const payload = await response.json();
    setPending(false);

    if (!response.ok) {
      setError(payload.error ?? "Failed to save Teams message template.");
      return;
    }

    if (editingId) {
      onTemplatesChange(
        templates.map((template) => (template.id === payload.id ? payload : template))
      );
    } else {
      onTemplatesChange([payload, ...templates]);
    }

    resetTemplateForm();
  }

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-col gap-1">
          <CardTitle>Shared message templates</CardTitle>
          <CardDescription>
            Templates are versioned assets. Automations can link to them instead of duplicating card JSON and image settings.
          </CardDescription>
        </div>
        {editingId && (
          <Button variant="outline" size="sm" onClick={resetTemplateForm}>
            New template
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <ScrollArea className="h-[200px] border rounded-md p-2">
            <div className="flex flex-col gap-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border bg-card/50"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{template.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        v{template.version}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          template.isActive
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {template.isActive ? "active" : "inactive"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {template.deliveryFormat} · {template.titleTemplate}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => startEdit(template)}
                  >
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor="templateName">Template name</Label>
              <Input
                id="templateName"
                required
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="templateDeliveryFormat">Delivery format</Label>
              <Select
                value={form.deliveryFormat}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    deliveryFormat: value as TeamsAutomationDeliveryFormat,
                  }))
                }
              >
                <SelectTrigger id="templateDeliveryFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAMS_AUTOMATION_DELIVERY_FORMATS.map((format) => (
                    <SelectItem key={format} value={format}>
                      {format}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="templateTitle">Title template</Label>
              <Input
                id="templateTitle"
                value={form.titleTemplate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, titleTemplate: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="templateMessage">Message template</Label>
              <Textarea
                id="templateMessage"
                rows={4}
                value={form.messageTemplate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, messageTemplate: event.target.value }))
                }
              />
            </div>

            {form.deliveryFormat !== "messageCard" && (
              <div className="grid gap-2">
                <Label htmlFor="templateAdaptiveJson">Adaptive card JSON</Label>
                <Textarea
                  id="templateAdaptiveJson"
                  rows={8}
                  value={form.adaptiveCardJson}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, adaptiveCardJson: event.target.value }))
                  }
                />
              </div>
            )}

            {form.deliveryFormat === "adaptiveCardWithImage" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="templateImageTitle">Image title template</Label>
                  <Input
                    id="templateImageTitle"
                    value={form.imageTitleTemplate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, imageTitleTemplate: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="templateImageSubtitle">Image subtitle template</Label>
                  <Input
                    id="templateImageSubtitle"
                    value={form.imageSubtitleTemplate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        imageSubtitleTemplate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="templateImageMetric">Image metric template</Label>
                  <Input
                    id="templateImageMetric"
                    value={form.imageMetricTemplate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, imageMetricTemplate: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="templateImageFooter">Image footer template</Label>
                  <Input
                    id="templateImageFooter"
                    value={form.imageFooterTemplate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, imageFooterTemplate: event.target.value }))
                    }
                  />
                </div>
              </>
            )}

            <div className="grid gap-2">
              <Label htmlFor="templateAccent">Accent color</Label>
              <Input
                id="templateAccent"
                value={form.imageAccentColor}
                onChange={(event) =>
                  setForm((current) => ({ ...current, imageAccentColor: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Facts</Label>
              <div className="flex flex-col gap-2">
                {form.facts.map((fact, index) => (
                  <div className="flex gap-2" key={`${fact.name}-${index}`}>
                    <Input
                      placeholder="Fact name"
                      value={fact.name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          facts: current.facts.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, name: event.target.value } : entry
                          ),
                        }))
                      }
                    />
                    <Input
                      placeholder="Value template"
                      value={fact.valueTemplate}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          facts: current.facts.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, valueTemplate: event.target.value } : entry
                          ),
                        }))
                      }
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      facts: [...current.facts, { name: "", valueTemplate: "" }],
                    }))
                  }
                >
                  Add fact
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="templateActive"
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, isActive: checked }))
                }
              />
              <Label htmlFor="templateActive">Template is active</Label>
            </div>

            {error && <div className="text-sm font-medium text-destructive">{error}</div>}

            <Button type="submit" disabled={pending} className="w-full">
              {pending
                ? "Saving..."
                : editingId
                ? "Update template"
                : "Create template"}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
