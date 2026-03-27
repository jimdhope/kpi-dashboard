"use client";

import { useState } from "react";
import { TEAMS_WEBHOOK_DIRECTIONS, TeamsWebhookRecord, TeamsWebhookDirection } from "@/lib/contracts";
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

interface TeamsWebhooksAdminProps {
  initialWebhooks: TeamsWebhookRecord[];
}

interface FormState {
  name: string;
  direction: TeamsWebhookDirection;
  url: string;
  description: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  name: "",
  direction: "outgoing",
  url: "",
  description: "",
  isActive: true,
};

export function TeamsWebhooksAdmin({ initialWebhooks }: TeamsWebhooksAdminProps) {
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(webhook: TeamsWebhookRecord) {
    setEditingId(webhook.id);
    setForm({
      name: webhook.name,
      direction: webhook.direction,
      url: webhook.url,
      description: webhook.description ?? "",
      isActive: webhook.isActive,
    });
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch(editingId ? `/api/integrations/teams-webhooks/${editingId}` : "/api/integrations/teams-webhooks", {
      method: editingId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: form.name,
        direction: form.direction,
        url: form.url,
        description: form.description || null,
        isActive: form.isActive,
      }),
    });

    const payload = await response.json();
    setPending(false);

    if (!response.ok) {
      setError(payload.error ?? "Failed to save Teams webhook.");
      return;
    }

    if (editingId) {
      setWebhooks((current) => current.map((webhook) => (webhook.id === payload.id ? payload : webhook)));
    } else {
      setWebhooks((current) => [...current, payload].sort((a, b) => a.name.localeCompare(b.name)));
    }

    resetForm();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Central Teams webhook registry</CardTitle>
          <CardDescription>
            Incoming and outgoing Teams endpoints are managed once here and assigned elsewhere by dropdown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{webhook.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                      {webhook.direction}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        webhook.isActive
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {webhook.isActive ? "active" : "inactive"}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => startEdit(webhook)}
                  >
                    Edit
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {webhook.description || webhook.url}
                </p>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  {webhook.url}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex flex-col gap-1">
            <CardTitle>{editingId ? "Edit Teams webhook" : "Create Teams webhook"}</CardTitle>
            <CardDescription>
              This will support future automation center features across campaigns, pods, and teams.
            </CardDescription>
          </div>
          {editingId && (
            <Button variant="outline" size="sm" onClick={resetForm}>
              New webhook
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
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

            <div className="grid gap-2">
              <Label htmlFor="direction">Direction</Label>
              <Select
                value={form.direction}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    direction: value as TeamsWebhookDirection,
                  }))
                }
              >
                <SelectTrigger id="direction">
                  <SelectValue placeholder="Select direction" />
                </SelectTrigger>
                <SelectContent>
                  {TEAMS_WEBHOOK_DIRECTIONS.map((direction) => (
                    <SelectItem key={direction} value={direction}>
                      {direction}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="url">Webhook URL</Label>
              <Input
                id="url"
                required
                type="url"
                value={form.url}
                onChange={(event) =>
                  setForm((current) => ({ ...current, url: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={4}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, isActive: checked }))
                }
              />
              <Label htmlFor="isActive">Webhook is active</Label>
            </div>

            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}

            <Button type="submit" disabled={pending} className="w-full">
              {pending
                ? "Saving..."
                : editingId
                ? "Update webhook"
                : "Create webhook"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
