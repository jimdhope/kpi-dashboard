"use client";

import { useState } from "react";
import { AppCampaign, TeamsWebhookRecord } from "@/lib/contracts";
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

interface CampaignsAdminProps {
  initialCampaigns: AppCampaign[];
  webhookOptions: TeamsWebhookRecord[];
}

interface FormState {
  name: string;
  description: string;
  isActive: boolean;
  incomingWebhookId: string;
  outgoingWebhookId: string;
}

const emptyForm: FormState = {
  name: "",
  description: "",
  isActive: true,
  incomingWebhookId: "",
  outgoingWebhookId: "",
};

export function CampaignsAdmin({ initialCampaigns, webhookOptions }: CampaignsAdminProps) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(campaign: AppCampaign) {
    setEditingId(campaign.id);
    setForm({
      name: campaign.name,
      description: campaign.description ?? "",
      isActive: campaign.isActive,
      incomingWebhookId: campaign.incomingWebhookId ?? "",
      outgoingWebhookId: campaign.outgoingWebhookId ?? "",
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

    const url = editingId ? `/api/campaigns/${editingId}` : "/api/campaigns";
    const method = editingId ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: form.name,
        description: form.description || null,
        isActive: form.isActive,
        incomingWebhookId: form.incomingWebhookId || null,
        outgoingWebhookId: form.outgoingWebhookId || null,
      }),
    });

    const payload = await response.json();
    setPending(false);

    if (!response.ok) {
      setError(payload.error ?? "Failed to save campaign.");
      return;
    }

    if (editingId) {
      setCampaigns((current) => current.map((campaign) => (campaign.id === payload.id ? payload : campaign)));
    } else {
      setCampaigns((current) => [payload, ...current]);
    }

    resetForm();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
          <CardDescription>
            Initial campaign CRUD on the new service layer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns created yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{campaign.name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          campaign.isActive
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {campaign.isActive ? "active" : "inactive"}
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => startEdit(campaign)}
                    >
                      Edit
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {campaign.description || "No description yet."}
                  </p>
                  <div className="text-xs text-muted-foreground mt-1">
                    In: {campaign.incomingWebhookName ?? "none"} · Out:{" "}
                    {campaign.outgoingWebhookName ?? "none"} · Updated{" "}
                    {new Date(campaign.updatedAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex flex-col gap-1">
            <CardTitle>{editingId ? "Edit campaign" : "Create campaign"}</CardTitle>
            <CardDescription>
              Simple CRUD now, richer rules and lifecycle later.
            </CardDescription>
          </div>
          {editingId && (
            <Button variant="outline" size="sm" onClick={resetForm}>
              New campaign
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={5}
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
              <Label htmlFor="isActive">Campaign is active</Label>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="incomingWebhook">Incoming Teams webhook</Label>
              <Select
                value={form.incomingWebhookId}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, incomingWebhookId: value }))
                }
              >
                <SelectTrigger id="incomingWebhook">
                  <SelectValue placeholder="Select webhook (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {webhookOptions
                    .filter(
                      (webhook) =>
                        webhook.direction === "incoming" && webhook.isActive
                    )
                    .map((webhook) => (
                      <SelectItem key={webhook.id} value={webhook.id}>
                        {webhook.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="outgoingWebhook">Outgoing Teams webhook</Label>
              <Select
                value={form.outgoingWebhookId}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, outgoingWebhookId: value }))
                }
              >
                <SelectTrigger id="outgoingWebhook">
                  <SelectValue placeholder="Select webhook (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {webhookOptions
                    .filter(
                      (webhook) =>
                        webhook.direction === "outgoing" && webhook.isActive
                    )
                    .map((webhook) => (
                      <SelectItem key={webhook.id} value={webhook.id}>
                        {webhook.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}

            <Button type="submit" disabled={pending} className="w-full">
              {pending
                ? "Saving..."
                : editingId
                ? "Update campaign"
                : "Create campaign"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
